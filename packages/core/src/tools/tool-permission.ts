import type { ToolPermission as ToolPermissionEnum } from "@paracosm/shared";
import { generateId } from "@paracosm/shared";
import type {
  ToolInternal,
  ToolExecutionContext,
  PermissionPolicy,
  PermissionResult,
  AuditLogEntry,
} from "./types.js";

const PERMISSION_HIERARCHY: Record<string, number> = {
  read: 0,
  write: 1,
  execute: 2,
  network: 3,
  file_system: 4,
  database: 5,
  admin: 6,
};

export class ToolPermissionManager {
  private policies: Map<string, PermissionPolicy> = new Map();
  private auditLog: AuditLogEntry[] = [];
  private grantedPermissions: Map<string, Set<string>> = new Map();
  private maxAuditLogSize: number;

  constructor(maxAuditLogSize: number = 5000) {
    this.maxAuditLogSize = maxAuditLogSize;
  }

  check(tool: ToolInternal, context: ToolExecutionContext): PermissionResult {
    const toolId = tool.id;
    const policy = this.policies.get(toolId);
    const requiredPermission = this.getRequiredPermission(tool.permissionLevel);

    if (policy) {
      if (policy.deniedRoles.length > 0) {
        for (const role of context.roles) {
          if (policy.deniedRoles.includes(role)) {
            this.recordAudit(
              toolId,
              context.userId,
              "deny",
              requiredPermission,
              "denied",
              `Role "${role}" is explicitly denied`
            );
            return {
              allowed: false,
              permission: requiredPermission,
              reason: `Role "${role}" is explicitly denied for tool "${toolId}"`,
              requiresEscalation: false,
              escalationTarget: null,
            };
          }
        }
      }

      if (policy.allowedRoles.length > 0) {
        const hasAllowedRole = context.roles.some((role) =>
          policy.allowedRoles.includes(role)
        );
        if (!hasAllowedRole) {
          this.recordAudit(
            toolId,
            context.userId,
            "deny",
            requiredPermission,
            "denied",
            "No allowed role present"
          );
          return {
            allowed: false,
            permission: requiredPermission,
            reason: `No allowed role for tool "${toolId}"`,
            requiresEscalation: true,
            escalationTarget: "admin",
          };
        }
      }

      if (policy.requireApproval) {
        const granted = this.grantedPermissions.get(`${context.userId}:${toolId}`);
        if (!granted || !granted.has(requiredPermission)) {
          this.recordAudit(
            toolId,
            context.userId,
            "check",
            requiredPermission,
            "denied",
            "Approval required but not granted"
          );
          return {
            allowed: false,
            permission: requiredPermission,
            reason: `Tool "${toolId}" requires explicit approval`,
            requiresEscalation: true,
            escalationTarget: "admin",
          };
        }
      }

      if (policy.sandboxRequired && !context.sandboxed) {
        this.recordAudit(
          toolId,
          context.userId,
          "check",
          requiredPermission,
          "denied",
          "Sandbox required but not active"
        );
        return {
          allowed: false,
          permission: requiredPermission,
          reason: `Tool "${toolId}" requires sandboxed execution`,
          requiresEscalation: false,
          escalationTarget: null,
        };
      }
    }

    if (!this.hasPermissionLevel(context.permissions, requiredPermission)) {
      this.recordAudit(
        toolId,
        context.userId,
        "check",
        requiredPermission,
        "denied",
        `Missing required permission: ${requiredPermission}`
      );
      return {
        allowed: false,
        permission: requiredPermission,
        reason: `Missing permission "${requiredPermission}" for tool "${toolId}"`,
        requiresEscalation: true,
        escalationTarget: "admin",
      };
    }

    this.recordAudit(
      toolId,
      context.userId,
      "check",
      requiredPermission,
      "allowed",
      "Permission check passed"
    );
    return {
      allowed: true,
      permission: requiredPermission,
      reason: "Permission granted",
      requiresEscalation: false,
      escalationTarget: null,
    };
  }

  grant(tool: ToolInternal, context: ToolExecutionContext): void {
    const toolId = tool.id;
    const requiredPermission = this.getRequiredPermission(tool.permissionLevel);
    const key = `${context.userId}:${toolId}`;
    let granted = this.grantedPermissions.get(key);
    if (!granted) {
      granted = new Set();
      this.grantedPermissions.set(key, granted);
    }
    granted.add(requiredPermission);
    this.recordAudit(
      toolId,
      context.userId,
      "grant",
      requiredPermission,
      "allowed",
      "Permission explicitly granted"
    );
  }

  revoke(tool: ToolInternal, context: ToolExecutionContext): void {
    const toolId = tool.id;
    const requiredPermission = this.getRequiredPermission(tool.permissionLevel);
    const key = `${context.userId}:${toolId}`;
    const granted = this.grantedPermissions.get(key);
    if (granted) {
      granted.delete(requiredPermission);
      if (granted.size === 0) {
        this.grantedPermissions.delete(key);
      }
    }
    this.recordAudit(
      toolId,
      context.userId,
      "revoke",
      requiredPermission,
      "denied",
      "Permission revoked"
    );
  }

  escalate(tool: ToolInternal, context: ToolExecutionContext): PermissionResult {
    const toolId = tool.id;
    const requiredPermission = this.getRequiredPermission(tool.permissionLevel);
    const hasAdminRole = context.roles.includes("admin");
    const hasAdminPermission = context.permissions.includes("admin" as ToolPermissionEnum);

    if (hasAdminRole || hasAdminPermission) {
      this.grant(tool, context);
      this.recordAudit(
        toolId,
        context.userId,
        "escalate",
        requiredPermission,
        "allowed",
        "Escalation granted via admin privileges"
      );
      return {
        allowed: true,
        permission: requiredPermission,
        reason: "Escalation granted via admin privileges",
        requiresEscalation: false,
        escalationTarget: null,
      };
    }

    this.recordAudit(
      toolId,
      context.userId,
      "escalate",
      requiredPermission,
      "denied",
      "Escalation denied: no admin privileges"
    );
    return {
      allowed: false,
      permission: requiredPermission,
      reason: "Escalation denied: user does not have admin privileges",
      requiresEscalation: true,
      escalationTarget: "admin",
    };
  }

  audit(): AuditLogEntry[] {
    return [...this.auditLog];
  }

  policy(tool: ToolInternal, policy: PermissionPolicy): void {
    this.policies.set(tool.id, policy);
  }

  removePolicy(toolId: string): void {
    this.policies.delete(toolId);
  }

  getPolicy(toolId: string): PermissionPolicy | undefined {
    return this.policies.get(toolId);
  }

  getAuditLogForTool(toolId: string): AuditLogEntry[] {
    return this.auditLog.filter((entry) => entry.toolId === toolId);
  }

  getAuditLogForUser(userId: string): AuditLogEntry[] {
    return this.auditLog.filter((entry) => entry.userId === userId);
  }

  clearAuditLog(): void {
    this.auditLog = [];
  }

  isGranted(userId: string, toolId: string, permission: string): boolean {
    const key = `${userId}:${toolId}`;
    const granted = this.grantedPermissions.get(key);
    return granted ? granted.has(permission) : false;
  }

  private getRequiredPermission(permissionLevel: "safe" | "caution" | "dangerous"): ToolPermissionEnum {
    switch (permissionLevel) {
      case "safe":
        return "read" as ToolPermissionEnum;
      case "caution":
        return "execute" as ToolPermissionEnum;
      case "dangerous":
        return "admin" as ToolPermissionEnum;
    }
  }

  private hasPermissionLevel(
    userPermissions: ToolPermissionEnum[],
    required: ToolPermissionEnum
  ): boolean {
    const requiredLevel = PERMISSION_HIERARCHY[required] ?? 0;
    for (const perm of userPermissions) {
      const userLevel = PERMISSION_HIERARCHY[perm] ?? 0;
      if (userLevel >= requiredLevel) {
        return true;
      }
    }
    return false;
  }

  private recordAudit(
    toolId: string,
    userId: string,
    action: AuditLogEntry["action"],
    permission: ToolPermissionEnum,
    result: AuditLogEntry["result"],
    reason: string
  ): void {
    const entry: AuditLogEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      toolId,
      userId,
      action,
      permission,
      result,
      reason,
      context: {},
    };
    this.auditLog.push(entry);
    if (this.auditLog.length > this.maxAuditLogSize) {
      this.auditLog.shift();
    }
  }
}
