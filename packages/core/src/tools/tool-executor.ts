import type { ToolResult } from "@paracosm/shared";
import { ToolError } from "@paracosm/shared";
import type {
  ToolInternal,
  ToolExecutionContext,
  ToolExecutionResult,
  ExecutionReport,
} from "./types.js";
import { ToolRegistry } from "./tool-registry.js";
import { ToolSandbox } from "./tool-sandbox.js";
import { ToolPermissionManager } from "./tool-permission.js";
import { generateId, withTimeout, retry as retryAsync } from "@paracosm/shared";

export class ToolExecutor {
  private registry: ToolRegistry;
  private sandboxManager: ToolSandbox;
  private permissionManager: ToolPermissionManager;
  private executionHistory: Map<string, ExecutionReport> = new Map();
  private activeExecutions: Map<string, { startTime: number; toolId: string }> = new Map();
  private maxHistorySize: number;

  constructor(
    registry: ToolRegistry,
    sandboxManager: ToolSandbox,
    permissionManager: ToolPermissionManager,
    maxHistorySize: number = 1000
  ) {
    this.registry = registry;
    this.sandboxManager = sandboxManager;
    this.permissionManager = permissionManager;
    this.maxHistorySize = maxHistorySize;
  }

  async execute(
    toolId: string,
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const executionId = generateId();
    const startTime = Date.now();

    const tool = this.registry.getInternal(toolId);
    if (!tool) {
      return this.createErrorResult(
        executionId,
        toolId,
        `Tool "${toolId}" not found in registry`,
        0
      );
    }

    if (!this.validate(toolId, params)) {
      return this.createErrorResult(
        executionId,
        toolId,
        `Parameter validation failed for tool "${toolId}"`,
        Date.now() - startTime
      );
    }

    const permResult = this.permissionManager.check(tool, context);
    if (!permResult.allowed) {
      const report = this.createReport(
        executionId,
        toolId,
        "permission_denied",
        startTime,
        0,
        0,
        0,
        0,
        `Permission denied: ${permResult.reason}`
      );
      this.recordReport(report);
      return this.createErrorResult(
        executionId,
        toolId,
        `Permission denied: ${permResult.reason}`,
        Date.now() - startTime
      );
    }

    this.activeExecutions.set(executionId, { startTime, toolId });

    try {
      let result: ToolExecutionResult;
      if (context.sandboxed || tool.requiresSandbox) {
        result = await this.sandboxExecute(tool, params, context, executionId);
      } else {
        result = await tool.execute(params, context);
      }

      const durationMs = Date.now() - startTime;
      const report = this.createReport(
        executionId,
        toolId,
        result.success ? "success" : "failure",
        startTime,
        durationMs,
        result.memoryUsedBytes,
        result.cpuTimeMs,
        result.retries,
        result.error
      );
      this.recordReport(report);

      return {
        toolId: toolId as any,
        success: result.success,
        data: result.data,
        error: result.error,
        executionTimeMs: result.executionTimeMs,
        metadata: {
          executionId,
          memoryUsedBytes: result.memoryUsedBytes,
          cpuTimeMs: result.cpuTimeMs,
          retries: result.retries,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const report = this.createReport(
        executionId,
        toolId,
        "failure",
        startTime,
        durationMs,
        0,
        0,
        0,
        errorMessage
      );
      this.recordReport(report);

      return this.createErrorResult(executionId, toolId, errorMessage, durationMs);
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  validate(toolId: string, params: Record<string, unknown>): boolean {
    const tool = this.registry.getInternal(toolId);
    if (!tool) {
      return false;
    }
    for (const param of tool.parameters) {
      if (param.required) {
        if (!(param.name in params) || params[param.name] === undefined || params[param.name] === null) {
          if (param.defaultValue === undefined || param.defaultValue === null) {
            return false;
          }
        }
      }
      if (param.name in params && params[param.name] !== undefined && params[param.name] !== null) {
        const value = params[param.name];
        const expectedType = param.type;
        let typeValid = true;
        switch (expectedType) {
          case "string":
            typeValid = typeof value === "string";
            break;
          case "number":
            typeValid = typeof value === "number" && Number.isFinite(value);
            break;
          case "boolean":
            typeValid = typeof value === "boolean";
            break;
          case "object":
            typeValid = typeof value === "object" && value !== null && !Array.isArray(value);
            break;
          case "array":
            typeValid = Array.isArray(value);
            break;
        }
        if (!typeValid) {
          return false;
        }
        if (param.enum && param.enum.length > 0) {
          if (!param.enum.includes(String(value))) {
            return false;
          }
        }
      }
    }
    return tool.validate(params);
  }

  async sandbox(
    toolId: string,
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const tool = this.registry.getInternal(toolId);
    if (!tool) {
      throw new ToolError(`Tool "${toolId}" not found in registry`, { toolId });
    }
    const sandboxedContext: ToolExecutionContext = {
      ...context,
      sandboxed: true,
    };
    return this.execute(toolId, params, sandboxedContext);
  }

  async timeout(
    toolId: string,
    params: Record<string, unknown>,
    ms: number
  ): Promise<ToolResult> {
    const executionPromise = this.execute(toolId, params, {
      sessionId: generateId(),
      userId: "system",
      roles: [],
      permissions: [],
      metadata: {},
      parentExecutionId: null,
      timeout: ms,
      sandboxed: false,
      maxRetries: 0,
    });
    try {
      return await withTimeout(executionPromise, ms);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        toolId: toolId as any,
        success: false,
        data: null,
        error: message,
        executionTimeMs: ms,
        metadata: { timedOut: true },
        timestamp: new Date().toISOString(),
      };
    }
  }

  async retry(
    toolId: string,
    params: Record<string, unknown>,
    maxRetries: number
  ): Promise<ToolResult> {
    const context: ToolExecutionContext = {
      sessionId: generateId(),
      userId: "system",
      roles: [],
      permissions: [],
      metadata: {},
      parentExecutionId: null,
      timeout: 30000,
      sandboxed: false,
      maxRetries,
    };
    let lastResult: ToolResult | null = null;
    let attempt = 0;
    while (attempt <= maxRetries) {
      const result = await this.execute(toolId, params, context);
      if (result.success) {
        return result;
      }
      lastResult = result;
      attempt++;
      if (attempt <= maxRetries) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return lastResult!;
  }

  report(execution: ToolExecutionResult): ExecutionReport {
    const status = this.determineStatus(execution);
    return {
      executionId: execution.executionId,
      toolId: execution.toolId,
      status,
      startTime: execution.timestamp,
      endTime: new Date().toISOString(),
      durationMs: execution.executionTimeMs,
      memoryUsedBytes: execution.memoryUsedBytes,
      cpuTimeMs: execution.cpuTimeMs,
      retries: execution.retries,
      error: execution.error,
      metadata: {},
    };
  }

  getExecutionHistory(toolId?: string): ExecutionReport[] {
    const reports = Array.from(this.executionHistory.values());
    if (toolId) {
      return reports.filter((r) => r.toolId === toolId);
    }
    return reports;
  }

  getActiveExecutions(): Array<{ executionId: string; toolId: string; elapsedMs: number }> {
    const now = Date.now();
    return Array.from(this.activeExecutions.entries()).map(([id, info]) => ({
      executionId: id,
      toolId: info.toolId,
      elapsedMs: now - info.startTime,
    }));
  }

  clearHistory(): void {
    this.executionHistory.clear();
  }

  private async sandboxExecute(
    tool: ToolInternal,
    params: Record<string, unknown>,
    context: ToolExecutionContext,
    executionId: string
  ): Promise<ToolExecutionResult> {
    const sandboxConfig = {
      maxMemoryBytes: 128 * 1024 * 1024,
      maxCpuTimeMs: context.timeout,
      maxExecutionTimeMs: context.timeout,
      maxFileSizeBytes: 10 * 1024 * 1024,
      allowNetwork: false,
      allowFileSystem: false,
      allowSubprocess: false,
      environmentVariables: {},
      allowedModules: [],
      blockedModules: ["child_process", "fs", "net", "http", "https", "os"],
    };
    const sandboxInstance = this.sandboxManager.create(sandboxConfig);
    try {
      const wrappedCode = async () => {
        return tool.execute(params, context);
      };
      const result = await this.sandboxManager.run(wrappedCode, context);
      return result as ToolExecutionResult;
    } finally {
      this.sandboxManager.cleanup(sandboxInstance);
    }
  }

  private createErrorResult(
    executionId: string,
    toolId: string,
    error: string,
    executionTimeMs: number
  ): ToolResult {
    return {
      toolId: toolId as any,
      success: false,
      data: null,
      error,
      executionTimeMs,
      metadata: { executionId },
      timestamp: new Date().toISOString(),
    };
  }

  private createReport(
    executionId: string,
    toolId: string,
    status: ExecutionReport["status"],
    startTime: number,
    durationMs: number,
    memoryUsedBytes: number,
    cpuTimeMs: number,
    retries: number,
    error: string | null
  ): ExecutionReport {
    return {
      executionId,
      toolId,
      status,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      durationMs,
      memoryUsedBytes,
      cpuTimeMs,
      retries,
      error,
      metadata: {},
    };
  }

  private recordReport(report: ExecutionReport): void {
    this.executionHistory.set(report.executionId, report);
    if (this.executionHistory.size > this.maxHistorySize) {
      const oldestKey = this.executionHistory.keys().next().value;
      if (oldestKey) {
        this.executionHistory.delete(oldestKey);
      }
    }
  }

  private determineStatus(execution: ToolExecutionResult): ExecutionReport["status"] {
    if (execution.success) {
      return "success";
    }
    if (execution.error && execution.error.includes("timeout")) {
      return "timeout";
    }
    if (execution.error && execution.error.includes("permission")) {
      return "permission_denied";
    }
    if (execution.error && execution.error.includes("validation")) {
      return "validation_error";
    }
    return "failure";
  }
}
