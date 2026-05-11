import type { ToolResult, ToolId } from '@paracosm/shared';
import { ok, err, type Result, createLogger } from '@paracosm/shared';
import { ToolRegistry } from './tool-registry.js';
import type { ToolExecutionContext } from './types.js';

const logger = createLogger('ToolExecutor');

export class ToolExecutor {
  private registry: ToolRegistry;
  private executionHistory: Array<{ toolId: ToolId; timestamp: Date; duration: number; success: boolean }> = [];

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  async execute(toolId: ToolId, input: unknown, context: ToolExecutionContext): Promise<Result<ToolResult>> {
    const definition = this.registry.get(toolId);
    if (!definition) {
      return err(new Error(`Tool ${toolId} not found`));
    }
    if (definition.validate) {
      const errors = definition.validate(input);
      if (errors.length > 0) {
        return err(new Error(`Validation failed: ${errors.join(', ')}`));
      }
    }
    const startTime = Date.now();
    try {
      const result = await definition.handler(input, context);
      const duration = Date.now() - startTime;
      this.executionHistory.push({ toolId, timestamp: new Date(), duration, success: result.success });
      logger.info(`Tool ${toolId} executed in ${duration}ms, success: ${result.success}`);
      return ok(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.executionHistory.push({ toolId, timestamp: new Date(), duration, success: false });
      const message = error instanceof Error ? error.message : String(error);
      return ok({
        toolId,
        success: false,
        output: null,
        error: message,
        duration,
        metadata: {},
        timestamp: new Date(),
      });
    }
  }

  getExecutionHistory(toolId?: ToolId): Array<{ toolId: ToolId; timestamp: Date; duration: number; success: boolean }> {
    if (toolId) {
      return this.executionHistory.filter((h) => h.toolId === toolId);
    }
    return [...this.executionHistory];
  }

  getSuccessRate(toolId: ToolId): number {
    const history = this.executionHistory.filter((h) => h.toolId === toolId);
    if (history.length === 0) return 0;
    return history.filter((h) => h.success).length / history.length;
  }

  getAverageDuration(toolId: ToolId): number {
    const history = this.executionHistory.filter((h) => h.toolId === toolId);
    if (history.length === 0) return 0;
    return history.reduce((sum, h) => sum + h.duration, 0) / history.length;
  }

  clear(): void {
    this.executionHistory = [];
  }
}
