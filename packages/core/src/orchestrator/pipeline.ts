import type { PipelineStage, PipelineConfig } from "./types.js";
import type { Result } from "@paracosm/shared";
import { err, ok } from "@paracosm/shared";
import { EventBus } from "./event-bus.js";

interface StageExecution {
  stage: PipelineStage;
  retryCount: number;
  maxRetries: number;
  retryDelay: number;
}

interface PipelineError {
  stageName: string;
  error: Error;
  retryable: boolean;
  timestamp: string;
}

type ErrorHandler = (error: PipelineError, pipeline: Pipeline) => void;

export class Pipeline {
  private name: string;
  private stages: StageExecution[];
  private errorHandlers: ErrorHandler[];
  private eventBus: EventBus;
  private continueOnError: boolean;
  private globalTimeout: number;

  constructor(name: string) {
    this.name = name;
    this.stages = [];
    this.errorHandlers = [];
    this.eventBus = new EventBus();
    this.continueOnError = false;
    this.globalTimeout = 300000;
  }

  static create(name: string): Pipeline {
    return new Pipeline(name);
  }

  addStage(stage: PipelineStage): Pipeline {
    this.stages.push({
      stage,
      retryCount: 0,
      maxRetries: stage.retries ?? 0,
      retryDelay: stage.retryDelay ?? 1000,
    });
    return this;
  }

  removeStage(name: string): Pipeline {
    const index = this.stages.findIndex((s) => s.stage.name === name);
    if (index !== -1) {
      this.stages.splice(index, 1);
    }
    return this;
  }

  validate(): boolean {
    if (this.stages.length === 0) {
      return false;
    }

    const names = new Set<string>();
    for (const { stage } of this.stages) {
      if (!stage.name || stage.name.trim().length === 0) {
        return false;
      }
      if (names.has(stage.name)) {
        return false;
      }
      names.add(stage.name);
      if (typeof stage.execute !== "function") {
        return false;
      }
    }

    return true;
  }

  async execute(input: unknown): Promise<Result<unknown>> {
    if (!this.validate()) {
      return err(new Error(`Pipeline "${this.name}" validation failed: empty or duplicate stage names`));
    }

    this.eventBus.emit("pipeline:started", { name: this.name, input });

    let currentInput = input;
    const executedStages: Array<{ stage: PipelineStage; result: unknown }> = [];
    const startTime = Date.now();

    for (let i = 0; i < this.stages.length; i++) {
      const stageExec = this.stages[i];
      const stage = stageExec.stage;

      this.eventBus.emit("stage:started", {
        pipeline: this.name,
        stage: stage.name,
        index: i,
      });

      const stageResult = await this.executeStageWithRetry(stageExec, currentInput);

      if (!stageResult.ok) {
        const pipelineError: PipelineError = {
          stageName: stage.name,
          error: stageResult.error,
          retryable: stageExec.retryCount < stageExec.maxRetries,
          timestamp: new Date().toISOString(),
        };

        this.eventBus.emit("stage:failed", {
          pipeline: this.name,
          stage: stage.name,
          error: stageResult.error.message,
        });

        for (const handler of this.errorHandlers) {
          try {
            handler(pipelineError, this);
          } catch {
            continue;
          }
        }

        if (stage.rollback) {
          try {
            await stage.rollback(currentInput);
            this.eventBus.emit("stage:rolled_back", {
              pipeline: this.name,
              stage: stage.name,
            });
          } catch (rollbackError) {
            this.eventBus.emit("stage:rollback_failed", {
              pipeline: this.name,
              stage: stage.name,
              error: (rollbackError as Error).message,
            });
          }
        }

        if (!this.continueOnError) {
          for (let j = executedStages.length - 1; j >= 0; j--) {
            const executed = executedStages[j];
            if (executed.stage.rollback) {
              try {
                await executed.stage.rollback(executed.result);
              } catch {
                continue;
              }
            }
          }

          this.eventBus.emit("pipeline:failed", {
            name: this.name,
            stage: stage.name,
            error: stageResult.error.message,
            duration: Date.now() - startTime,
          });

          return err(stageResult.error);
        }

        continue;
      }

      currentInput = stageResult.value;
      executedStages.push({ stage, result: currentInput });

      this.eventBus.emit("stage:completed", {
        pipeline: this.name,
        stage: stage.name,
        index: i,
      });
    }

    this.eventBus.emit("pipeline:completed", {
      name: this.name,
      duration: Date.now() - startTime,
    });

    return ok(currentInput);
  }

  onError(handler: ErrorHandler): Pipeline {
    this.errorHandlers.push(handler);
    return this;
  }

  retry(stageName: string, maxRetries: number): Pipeline {
    const stageExec = this.stages.find((s) => s.stage.name === stageName);
    if (stageExec) {
      stageExec.maxRetries = maxRetries;
    }
    return this;
  }

  setContinueOnError(value: boolean): Pipeline {
    this.continueOnError = value;
    return this;
  }

  setTimeout(timeout: number): Pipeline {
    this.globalTimeout = timeout;
    return this;
  }

  getStages(): string[] {
    return this.stages.map((s) => s.stage.name);
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }

  getName(): string {
    return this.name;
  }

  private async executeStageWithRetry(
    stageExec: StageExecution,
    input: unknown
  ): Promise<Result<unknown>> {
    const { stage, maxRetries, retryDelay } = stageExec;
    let lastError: Error = new Error("Unknown error");
    stageExec.retryCount = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const timeoutMs = stage.timeout ?? this.globalTimeout;
        const result = await this.executeWithTimeout(stage.execute, input, timeoutMs);
        stageExec.retryCount = attempt;
        return ok(result);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        stageExec.retryCount = attempt;

        if (attempt < maxRetries) {
          this.eventBus.emit("stage:retrying", {
            stage: stage.name,
            attempt: attempt + 1,
            maxRetries,
            error: lastError.message,
          });

          await this.delay(retryDelay * Math.pow(2, attempt));
        }
      }
    }

    return err(lastError);
  }

  private async executeWithTimeout(
    fn: (input: unknown) => Promise<unknown>,
    input: unknown,
    timeoutMs: number
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Stage execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn(input)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
