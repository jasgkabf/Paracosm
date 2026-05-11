import type { Tool, ToolPermission } from "@paracosm/shared";
import { ToolError } from "@paracosm/shared";
import type {
  ToolInternal,
  ToolExecutionContext,
  PermissionPolicy,
} from "./types.js";
import { generateId } from "@paracosm/shared";

export class ToolRegistry {
  private tools: Map<string, ToolInternal> = new Map();
  private categories: Map<string, Set<string>> = new Map();
  private policies: Map<string, PermissionPolicy> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private registrationOrder: string[] = [];

  register(tool: ToolInternal): void {
    if (!tool.id || tool.id.trim().length === 0) {
      throw new ToolError("Tool must have a non-empty id", { toolName: tool.name });
    }
    if (this.tools.has(tool.id)) {
      throw new ToolError(`Tool with id "${tool.id}" is already registered`, {
        toolId: tool.id,
      });
    }
    if (!this.validate(tool)) {
      throw new ToolError(`Tool validation failed for "${tool.name}"`, {
        toolId: tool.id,
        toolName: tool.name,
      });
    }
    this.tools.set(tool.id, tool);
    this.registrationOrder.push(tool.id);
    const category = tool.category;
    if (!this.categories.has(category)) {
      this.categories.set(category, new Set());
    }
    this.categories.get(category)!.add(tool.id);
    if (tool.dependencies && tool.dependencies.length > 0) {
      this.dependencyGraph.set(tool.id, new Set(tool.dependencies));
    }
  }

  unregister(id: string): void {
    const tool = this.tools.get(id);
    if (!tool) {
      return;
    }
    for (const [dependentId, deps] of this.dependencyGraph.entries()) {
      if (deps.has(id)) {
        throw new ToolError(
          `Cannot unregister tool "${id}" because tool "${dependentId}" depends on it`,
          { toolId: id, dependentId }
        );
      }
    }
    this.tools.delete(id);
    const category = tool.category;
    const categorySet = this.categories.get(category);
    if (categorySet) {
      categorySet.delete(id);
      if (categorySet.size === 0) {
        this.categories.delete(category);
      }
    }
    this.dependencyGraph.delete(id);
    const orderIndex = this.registrationOrder.indexOf(id);
    if (orderIndex !== -1) {
      this.registrationOrder.splice(orderIndex, 1);
    }
  }

  get(id: string): Tool | undefined {
    const internal = this.tools.get(id);
    if (!internal) {
      return undefined;
    }
    return this.toPublicTool(internal);
  }

  getInternal(id: string): ToolInternal | undefined {
    return this.tools.get(id);
  }

  list(): Tool[] {
    return this.registrationOrder
      .map((id) => this.tools.get(id))
      .filter((t): t is ToolInternal => t !== undefined)
      .map((t) => this.toPublicTool(t));
  }

  search(query: string): Tool[] {
    const normalizedQuery = query.toLowerCase().trim();
    if (normalizedQuery.length === 0) {
      return this.list();
    }
    const terms = normalizedQuery.split(/\s+/);
    const scored: Array<{ tool: Tool; score: number }> = [];
    for (const id of this.registrationOrder) {
      const internal = this.tools.get(id);
      if (!internal) continue;
      const tool = this.toPublicTool(internal);
      let score = 0;
      const nameLower = tool.name.toLowerCase();
      const descLower = tool.description.toLowerCase();
      const typeStr = tool.type.toLowerCase();
      for (const term of terms) {
        if (nameLower === term) {
          score += 10;
        } else if (nameLower.includes(term)) {
          score += 7;
        }
        if (descLower.includes(term)) {
          score += 3;
        }
        if (typeStr.includes(term)) {
          score += 5;
        }
        if (internal.category.toLowerCase().includes(term)) {
          score += 4;
        }
        for (const param of tool.parameters) {
          if (param.name.toLowerCase().includes(term)) {
            score += 2;
          }
          if (param.description.toLowerCase().includes(term)) {
            score += 1;
          }
        }
      }
      if (score > 0) {
        scored.push({ tool, score });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.tool);
  }

  validate(tool: ToolInternal): boolean {
    if (!tool.id || typeof tool.id !== "string" || tool.id.trim().length === 0) {
      return false;
    }
    if (!tool.name || typeof tool.name !== "string" || tool.name.trim().length === 0) {
      return false;
    }
    if (!tool.description || typeof tool.description !== "string") {
      return false;
    }
    if (!tool.type) {
      return false;
    }
    if (!Array.isArray(tool.parameters)) {
      return false;
    }
    for (const param of tool.parameters) {
      if (!param.name || typeof param.name !== "string") {
        return false;
      }
      if (!param.type || typeof param.type !== "string") {
        return false;
      }
      if (typeof param.required !== "boolean") {
        return false;
      }
    }
    if (typeof tool.execute !== "function") {
      return false;
    }
    if (!tool.category || typeof tool.category !== "string") {
      return false;
    }
    if (!["safe", "caution", "dangerous"].includes(tool.permissionLevel)) {
      return false;
    }
    if (typeof tool.rateLimitPerMinute !== "number" || tool.rateLimitPerMinute < 0) {
      return false;
    }
    if (typeof tool.maxConcurrentExecutions !== "number" || tool.maxConcurrentExecutions < 1) {
      return false;
    }
    if (tool.dependencies) {
      if (!Array.isArray(tool.dependencies)) {
        return false;
      }
      for (const dep of tool.dependencies) {
        if (typeof dep !== "string" || dep.trim().length === 0) {
          return false;
        }
      }
    }
    return true;
  }

  checkPermission(toolId: string, context: ToolExecutionContext): boolean {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return false;
    }
    const policy = this.policies.get(toolId);
    if (policy) {
      if (policy.deniedRoles.length > 0) {
        for (const role of context.roles) {
          if (policy.deniedRoles.includes(role)) {
            return false;
          }
        }
      }
      if (policy.allowedRoles.length > 0) {
        const hasAllowedRole = context.roles.some((role) =>
          policy.allowedRoles.includes(role)
        );
        if (!hasAllowedRole) {
          return false;
        }
      }
      if (policy.sandboxRequired && !context.sandboxed) {
        return false;
      }
    }
    if (tool.permissionLevel === "dangerous") {
      const hasAdminPermission = context.permissions.includes("admin" as ToolPermission);
      if (!hasAdminPermission) {
        return false;
      }
    }
    if (tool.permissionLevel === "caution") {
      const hasExecutePermission = context.permissions.includes("execute" as ToolPermission);
      if (!hasExecutePermission) {
        return false;
      }
    }
    return true;
  }

  resolveDependencies(toolId: string): Tool[] {
    const visited = new Set<string>();
    const result: Tool[] = [];
    const visit = (id: string) => {
      if (visited.has(id)) {
        return;
      }
      visited.add(id);
      const deps = this.dependencyGraph.get(id);
      if (deps) {
        for (const depId of deps) {
          visit(depId);
        }
      }
      const internal = this.tools.get(id);
      if (internal && id !== toolId) {
        result.push(this.toPublicTool(internal));
      }
    };
    visit(toolId);
    return result;
  }

  getByCategory(category: string): Tool[] {
    const ids = this.categories.get(category);
    if (!ids) {
      return [];
    }
    return Array.from(ids)
      .map((id) => this.tools.get(id))
      .filter((t): t is ToolInternal => t !== undefined)
      .map((t) => this.toPublicTool(t));
  }

  setPolicy(toolId: string, policy: PermissionPolicy): void {
    if (!this.tools.has(toolId)) {
      throw new ToolError(`Cannot set policy for unknown tool "${toolId}"`, {
        toolId,
      });
    }
    this.policies.set(toolId, policy);
  }

  getPolicy(toolId: string): PermissionPolicy | undefined {
    return this.policies.get(toolId);
  }

  removePolicy(toolId: string): void {
    this.policies.delete(toolId);
  }

  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  size(): number {
    return this.tools.size;
  }

  has(id: string): boolean {
    return this.tools.has(id);
  }

  clear(): void {
    this.tools.clear();
    this.categories.clear();
    this.policies.clear();
    this.dependencyGraph.clear();
    this.registrationOrder = [];
  }

  private toPublicTool(internal: ToolInternal): Tool {
    return {
      id: internal.id,
      name: internal.name,
      type: internal.type,
      description: internal.description,
      parameters: internal.parameters,
      returnType: internal.returnType,
      returnDescription: internal.returnDescription,
      version: internal.version,
      deprecated: internal.deprecated,
      deprecationMessage: internal.deprecationMessage,
      examples: internal.examples,
      createdAt: internal.createdAt,
      updatedAt: internal.updatedAt,
    };
  }
}
