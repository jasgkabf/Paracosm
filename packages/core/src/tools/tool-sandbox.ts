import type { ToolResult, ToolId } from '@paracosm/shared';
import { ok, err, type Result, createLogger } from '@paracosm/shared';
import type { SandboxConfig } from './types.js';
import { SANDBOX_DEFAULTS } from '@paracosm/shared';

const logger = createLogger('ToolSandbox');

export class ToolSandbox {
  private config: SandboxConfig;
  private activeExecutions: Map<string, { startedAt: Date; memoryUsed: number }> = new Map();

  constructor(config?: Partial<SandboxConfig>) {
    this.config = { ...SANDBOX_DEFAULTS, ...config } as SandboxConfig;
  }

  async execute(code: string, context?: Record<string, unknown>): Promise<Result<unknown>> {
    const executionId = `sandbox_${Date.now()}`;
    this.activeExecutions.set(executionId, { startedAt: new Date(), memoryUsed: 0 });
    try {
      const startTime = Date.now();
      if (Date.now() - startTime > this.config.maxCpuTimeMs) {
        return err(new Error('Execution timed out'));
      }
      const fn = new Function('context', `with(context || {}) { return (function() { ${code} })(); }`);
      const result = fn(context ?? {});
      const outputStr = JSON.stringify(result);
      if (outputStr.length > this.config.maxOutputLength) {
        return err(new Error(`Output exceeds maximum length (${this.config.maxOutputLength})`));
      }
      this.activeExecutions.delete(executionId);
      return ok(result);
    } catch (error) {
      this.activeExecutions.delete(executionId);
      const message = error instanceof Error ? error.message : String(error);
      return err(new Error(`Sandbox execution failed: ${message}`));
    }
  }

  isCommandAllowed(command: string): boolean {
    const baseCommand = command.trim().split(/\s+/)[0];
    if (this.config.blockedCommands.some((blocked) => command.includes(blocked))) {
      return false;
    }
    if (this.config.allowedCommands.length > 0 && !this.config.allowedCommands.includes(baseCommand)) {
      return false;
    }
    return true;
  }

  getConfig(): SandboxConfig {
    return { ...this.config };
  }

  getActiveExecutions(): number {
    return this.activeExecutions.size;
  }

  clear(): void {
    this.activeExecutions.clear();
  }
}
