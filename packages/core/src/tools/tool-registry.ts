import type { Tool, ToolResult, ToolId, ToolType } from '@paracosm/shared';
import { generateId, ok, err, type Result, createLogger } from '@paracosm/shared';
import type { ToolDefinition, ToolExecutionContext } from './types.js';

const logger = createLogger('ToolRegistry');

export class ToolRegistry {
  private tools: Map<ToolId, ToolDefinition> = new Map();
  private typeIndex: Map<ToolType, Set<ToolId>> = new Map();
  private listeners: Array<(event: string, data: unknown) => void> = [];

  on(listener: (event: string, data: unknown) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  private emit(event: string, data: unknown): void {
    for (const listener of this.listeners) listener(event, data);
  }

  register(definition: ToolDefinition): Result<ToolDefinition> {
    if (this.tools.has(definition.id)) {
      return err(new Error(`Tool ${definition.id} already registered`));
    }
    this.tools.set(definition.id, definition);
    const typeSet = this.typeIndex.get(definition.type) ?? new Set();
    typeSet.add(definition.id);
    this.typeIndex.set(definition.type, typeSet);
    logger.info(`Registered tool: ${definition.name} (${definition.id})`);
    this.emit('tool:registered', definition);
    return ok(definition);
  }

  unregister(toolId: ToolId): Result<boolean> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return err(new Error(`Tool ${toolId} not found`));
    }
    this.tools.delete(toolId);
    const typeSet = this.typeIndex.get(tool.type);
    if (typeSet) {
      typeSet.delete(toolId);
      if (typeSet.size === 0) this.typeIndex.delete(tool.type);
    }
    this.emit('tool:unregistered', tool);
    return ok(true);
  }

  get(toolId: ToolId): ToolDefinition | undefined {
    return this.tools.get(toolId);
  }

  getByType(type: ToolType): ToolDefinition[] {
    const ids = this.typeIndex.get(type);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.tools.get(id))
      .filter((t): t is ToolDefinition => t !== undefined);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  has(toolId: ToolId): boolean {
    return this.tools.has(toolId);
  }

  getCount(): number {
    return this.tools.size;
  }

  clear(): void {
    this.tools.clear();
    this.typeIndex.clear();
    this.emit('registry:cleared', null);
  }
}
