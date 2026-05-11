import type { ToolPermission as ToolPermType, ToolId } from '@paracosm/shared';
import { ok, err, type Result, createLogger } from '@paracosm/shared';

const logger = createLogger('ToolPermission');

export class ToolPermission {
  private permissions: Map<ToolId, ToolPermType[]> = new Map();
  private globalPermissions: ToolPermType[] = [];

  setPermissions(toolId: ToolId, permissions: ToolPermType[]): void {
    this.permissions.set(toolId, permissions);
  }

  getPermissions(toolId: ToolId): ToolPermType[] {
    return this.permissions.get(toolId) ?? [];
  }

  setGlobalPermissions(permissions: ToolPermType[]): void {
    this.globalPermissions = permissions;
  }

  checkPermission(toolId: ToolId, resource: string, action: 'read' | 'write' | 'execute' | 'delete' | 'admin'): Result<boolean> {
    const toolPerms = this.permissions.get(toolId) ?? [];
    const allPerms = [...this.globalPermissions, ...toolPerms];
    const hasPermission = allPerms.some(
      (p) => p.resource === resource && p.actions.includes(action),
    );
    if (!hasPermission) {
      return err(new Error(`Permission denied: ${action} on ${resource} for tool ${toolId}`));
    }
    return ok(true);
  }

  checkAnyPermission(toolId: ToolId, resource: string): Result<boolean> {
    const toolPerms = this.permissions.get(toolId) ?? [];
    const allPerms = [...this.globalPermissions, ...toolPerms];
    const hasPermission = allPerms.some((p) => p.resource === resource);
    if (!hasPermission) {
      return err(new Error(`No permissions for resource ${resource} on tool ${toolId}`));
    }
    return ok(true);
  }

  grantPermission(toolId: ToolId, resource: string, actions: Array<'read' | 'write' | 'execute' | 'delete' | 'admin'>): void {
    const perms = this.permissions.get(toolId) ?? [];
    const existing = perms.find((p) => p.resource === resource);
    if (existing) {
      existing.actions = [...new Set([...existing.actions, ...actions])];
    } else {
      perms.push({ resource, actions, constraints: {} });
    }
    this.permissions.set(toolId, perms);
  }

  revokePermission(toolId: ToolId, resource: string, actions?: Array<'read' | 'write' | 'execute' | 'delete' | 'admin'>): void {
    const perms = this.permissions.get(toolId);
    if (!perms) return;
    if (actions) {
      const existing = perms.find((p) => p.resource === resource);
      if (existing) {
        existing.actions = existing.actions.filter((a) => !actions.includes(a));
        if (existing.actions.length === 0) {
          this.permissions.set(toolId, perms.filter((p) => p.resource !== resource));
        }
      }
    } else {
      this.permissions.set(toolId, perms.filter((p) => p.resource !== resource));
    }
  }

  clear(): void {
    this.permissions.clear();
    this.globalPermissions = [];
  }
}
