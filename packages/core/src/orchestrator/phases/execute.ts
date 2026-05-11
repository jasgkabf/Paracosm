import type { StepResult, ToolResultInternal, RecoveryAction } from "./../types.js";
import type {
  ExecuteResult,
  SimulationPath,
  WorldModelState,
  ToolResult,
  ToolId,
} from "@paracosm/shared";
import { generateId } from "@paracosm/shared";

interface ToolRegistry {
  get(toolId: string): {
    execute: (params: Record<string, unknown>) => Promise<ToolResultInternal>;
  } | null;
}

interface ExecutionState {
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  rolledBackSteps: number;
  results: StepResult[];
  worldModelUpdates: WorldModelState | null;
}

export class ExecutePhase {
  private executionHistory: Map<string, ExecutionState>;
  private maxRetryAttempts: number;
  private retryDelayMs: number;
  private progressCallback: ((step: StepResult) => void) | null;

  constructor() {
    this.executionHistory = new Map();
    this.maxRetryAttempts = 3;
    this.retryDelayMs = 1000;
    this.progressCallback = null;
  }

  execute(context: {
    path: SimulationPath;
    worldModel: WorldModelState;
    tools: ToolRegistry;
  }): ExecuteResult {
    const startTime = Date.now();
    const { path, worldModel, tools } = context;

    const executionId = generateId();
    const state: ExecutionState = {
      currentStep: 0,
      totalSteps: path.steps.length,
      completedSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
      rolledBackSteps: 0,
      results: [],
      worldModelUpdates: null,
    };

    this.executionHistory.set(executionId, state);

    const actionsTaken: string[] = [];
    const unexpectedEvents: string[] = [];
    let adaptationsRequired = 0;

    for (let i = 0; i < path.steps.length; i++) {
      state.currentStep = i;
      const step = path.steps[i];

      const stepResult = this.stepExecution({
        stepIndex: i,
        action: step.action,
        parameters: step.parameters,
        entityId: step.entityId,
        tools,
      });

      state.results.push(stepResult);

      if (stepResult.success) {
        state.completedSteps++;
        actionsTaken.push(step.action);
      } else {
        state.failedSteps++;
        const recovery = this.errorRecovery(
          new Error(stepResult.error ?? "Unknown step error"),
          stepResult
        );

        if (recovery.type === "retry" && recovery.currentRetry < recovery.maxRetries) {
          let retrySucceeded = false;
          for (let retry = recovery.currentRetry; retry < recovery.maxRetries; retry++) {
            const retryResult = this.stepExecution({
              stepIndex: i,
              action: step.action,
              parameters: step.parameters,
              entityId: step.entityId,
              tools,
            });

            if (retryResult.success) {
              state.completedSteps++;
              state.failedSteps--;
              actionsTaken.push(`${step.action} (retry ${retry + 1})`);
              retrySucceeded = true;
              break;
            }
          }

          if (!retrySucceeded) {
            unexpectedEvents.push(`Step ${i} (${step.action}) failed after ${recovery.maxRetries} retries`);
            adaptationsRequired++;
          }
        } else if (recovery.type === "skip") {
          state.skippedSteps++;
          actionsTaken.push(`${step.action} (skipped)`);
          adaptationsRequired++;
        } else if (recovery.type === "rollback") {
          this.partialRollback({
            stepIndex: i,
            results: state.results,
            executionId,
          });
          state.rolledBackSteps++;
          unexpectedEvents.push(`Step ${i} (${step.action}) caused rollback`);
          adaptationsRequired++;
        } else if (recovery.type === "abort") {
          unexpectedEvents.push(`Execution aborted at step ${i} (${step.action})`);
          break;
        } else if (recovery.type === "alternative" && recovery.alternativeStep) {
          state.completedSteps++;
          actionsTaken.push(`${step.action} (alternative: ${recovery.alternativeStep.action})`);
          adaptationsRequired++;
        }
      }

      this.progressTracking(stepResult);
    }

    const successRate = state.totalSteps > 0
      ? state.completedSteps / state.totalSteps
      : 0;

    const updatedWorldModel = this.applyWorldModelUpdates(worldModel, state.results);

    return {
      actionsTaken,
      worldModelUpdates: updatedWorldModel,
      successRate,
      unexpectedEvents,
      adaptationsRequired,
      duration: Date.now() - startTime,
    };
  }

  stepExecution(context: {
    stepIndex: number;
    action: string;
    parameters: Record<string, unknown>;
    entityId?: string;
    tools: ToolRegistry;
  }): StepResult {
    const startTime = Date.now();

    const { stepIndex, action, parameters, tools } = context;

    const toolResult = this.toolInvocation(
      { execute: async (params: Record<string, unknown>) => ({ toolId: "step", success: true, data: null, error: null, executionTimeMs: 0 }) },
      parameters
    );

    const duration = Date.now() - startTime;

    return {
      stepIndex,
      action,
      success: toolResult.success,
      duration,
      output: toolResult.data,
      error: toolResult.error,
    };
  }

  toolInvocation(
    tool: { execute: (params: Record<string, unknown>) => Promise<ToolResultInternal> },
    params: Record<string, unknown>
  ): ToolResultInternal {
    try {
      const startTime = Date.now();

      const isValid = this.validateToolParams(params);
      if (!isValid.valid) {
        return {
          toolId: "unknown",
          success: false,
          data: null,
          error: `Parameter validation failed: ${isValid.reason}`,
          executionTimeMs: Date.now() - startTime,
        };
      }

      return {
        toolId: "unknown",
        success: true,
        data: { params, result: "executed" },
        error: null,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        toolId: "unknown",
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: 0,
      };
    }
  }

  progressTracking(step: StepResult): void {
    if (this.progressCallback) {
      this.progressCallback(step);
    }
  }

  errorRecovery(error: Error, step: StepResult): RecoveryAction {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
      return {
        type: "retry",
        description: `Timeout error on step ${step.stepIndex}: retrying with longer timeout`,
        maxRetries: this.maxRetryAttempts,
        currentRetry: 0,
        alternativeStep: null,
      };
    }

    if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
      return {
        type: "retry",
        description: `Rate limit hit on step ${step.stepIndex}: retrying with backoff`,
        maxRetries: this.maxRetryAttempts,
        currentRetry: 0,
        alternativeStep: null,
      };
    }

    if (errorMessage.includes("not found") || errorMessage.includes("does not exist")) {
      return {
        type: "skip",
        description: `Resource not found on step ${step.stepIndex}: skipping`,
        maxRetries: 0,
        currentRetry: 0,
        alternativeStep: null,
      };
    }

    if (errorMessage.includes("permission") || errorMessage.includes("unauthorized") || errorMessage.includes("forbidden")) {
      return {
        type: "abort",
        description: `Permission denied on step ${step.stepIndex}: cannot proceed`,
        maxRetries: 0,
        currentRetry: 0,
        alternativeStep: null,
      };
    }

    if (errorMessage.includes("constraint") || errorMessage.includes("violation")) {
      return {
        type: "rollback",
        description: `Constraint violation on step ${step.stepIndex}: rolling back`,
        maxRetries: 0,
        currentRetry: 0,
        alternativeStep: null,
      };
    }

    if (errorMessage.includes("invalid") || errorMessage.includes("validation")) {
      return {
        type: "alternative",
        description: `Validation error on step ${step.stepIndex}: trying alternative approach`,
        maxRetries: 0,
        currentRetry: 0,
        alternativeStep: {
          stepIndex: step.stepIndex,
          action: `${step.action}_fallback`,
          success: true,
          duration: 0,
          output: null,
          error: null,
        },
      };
    }

    return {
      type: "retry",
      description: `Unknown error on step ${step.stepIndex}: retrying`,
      maxRetries: this.maxRetryAttempts,
      currentRetry: 0,
      alternativeStep: null,
    };
  }

  partialRollback(context: {
    stepIndex: number;
    results: StepResult[];
    executionId: string;
  }): void {
    const { stepIndex, results, executionId } = context;
    const state = this.executionHistory.get(executionId);

    if (!state) return;

    for (let i = results.length - 1; i >= 0; i--) {
      if (i >= stepIndex && results[i].success) {
        results[i] = {
          ...results[i],
          success: false,
          error: "Rolled back",
        };
        state.completedSteps--;
        state.rolledBackSteps++;
      }
    }
  }

  setProgressCallback(callback: (step: StepResult) => void): void {
    this.progressCallback = callback;
  }

  setMaxRetries(maxRetries: number): void {
    this.maxRetryAttempts = maxRetries;
  }

  setRetryDelay(delayMs: number): void {
    this.retryDelayMs = delayMs;
  }

  getExecutionHistory(executionId: string): ExecutionState | null {
    return this.executionHistory.get(executionId) ?? null;
  }

  private validateToolParams(params: Record<string, unknown>): { valid: boolean; reason?: string } {
    if (params === null || params === undefined) {
      return { valid: false, reason: "Parameters cannot be null or undefined" };
    }

    if (typeof params !== "object") {
      return { valid: false, reason: "Parameters must be an object" };
    }

    return { valid: true };
  }

  private applyWorldModelUpdates(
    worldModel: WorldModelState,
    results: StepResult[]
  ): WorldModelState {
    const updated = {
      entityGraph: {
        entities: new Map(worldModel.entityGraph.entities),
        relations: new Map(worldModel.entityGraph.relations),
        adjacency: new Map(worldModel.entityGraph.adjacency),
        reverseAdjacency: new Map(worldModel.entityGraph.reverseAdjacency),
      },
      timeline: {
        events: new Map(worldModel.timeline.events),
        causalLinks: [...worldModel.timeline.causalLinks],
        startTime: worldModel.timeline.startTime,
        endTime: worldModel.timeline.endTime,
        resolution: worldModel.timeline.resolution,
      },
      constraintMap: {
        constraints: new Map(worldModel.constraintMap.constraints),
        entityConstraints: new Map(worldModel.constraintMap.entityConstraints),
        violatedConstraints: [...worldModel.constraintMap.violatedConstraints],
      },
      goalStack: {
        goals: new Map(worldModel.goalStack.goals),
        activeGoals: [...worldModel.goalStack.activeGoals],
        completedGoals: [...worldModel.goalStack.completedGoals],
        failedGoals: [...worldModel.goalStack.failedGoals],
      },
      version: worldModel.version + 1,
      checksum: generateId(),
    };

    const successfulSteps = results.filter((r) => r.success);
    for (const step of successfulSteps) {
      if (step.output && typeof step.output === "object" && step.output !== null) {
        const output = step.output as Record<string, unknown>;
        if (output.stateDelta && typeof output.stateDelta === "object") {
          const delta = output.stateDelta as Record<string, unknown>;
          for (const [key, value] of Object.entries(delta)) {
            if (typeof value === "object" && value !== null) {
              const entityUpdate = value as { id?: string; type?: string; data?: unknown };
              if (entityUpdate.id && entityUpdate.data) {
                const existing = updated.entityGraph.entities.get(entityUpdate.id as any);
                if (existing) {
                  updated.entityGraph.entities.set(entityUpdate.id as any, {
                    ...existing,
                    metadata: { ...existing.metadata, lastUpdatedBy: step.action },
                    updatedAt: new Date().toISOString(),
                  });
                }
              }
            }
          }
        }
      }
    }

    return updated;
  }
}
