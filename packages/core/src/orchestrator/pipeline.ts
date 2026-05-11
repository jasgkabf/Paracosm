import type { CSEPhase } from '@paracosm/shared';
import { ok, err, type Result, createLogger } from '@paracosm/shared';
import { EventBus } from './event-bus.js';
import type { PipelineStep } from './types.js';

const logger = createLogger('Pipeline');

export class Pipeline {
  private steps: PipelineStep[] = [];
  private eventBus: EventBus;
  private currentStepIndex: number = -1;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  addStep(step: PipelineStep): void {
    this.steps.push(step);
  }

  removeStep(stepId: string): Result<boolean> {
    const idx = this.steps.findIndex((s) => s.id === stepId);
    if (idx === -1) return err(new Error(`Step ${stepId} not found`));
    this.steps.splice(idx, 1);
    return ok(true);
  }

  getSteps(): PipelineStep[] {
    return [...this.steps];
  }

  getStepsByPhase(phase: CSEPhase): PipelineStep[] {
    return this.steps.filter((s) => s.phase === phase);
  }

  async execute(handlers: Map<string, (step: PipelineStep, context: Record<string, unknown>) => Promise<Record<string, unknown>>>, initialContext: Record<string, unknown> = {}): Promise<Result<Record<string, unknown>>> {
    let context = { ...initialContext };
    this.currentStepIndex = 0;
    for (const step of this.steps) {
      this.eventBus.emit('pipeline:step_start', { stepId: step.id, stepName: step.name });
      const handler = handlers.get(step.handler);
      if (!handler) {
        this.eventBus.emit('pipeline:step_error', { stepId: step.id, error: `Handler ${step.handler} not found` });
        return err(new Error(`Handler ${step.handler} not found for step ${step.id}`));
      }
      let attempts = 0;
      let success = false;
      while (attempts <= step.retries && !success) {
        try {
          const result = await handler(step, context);
          context = { ...context, ...result };
          success = true;
          this.eventBus.emit('pipeline:step_complete', { stepId: step.id, stepName: step.name });
        } catch (error) {
          attempts++;
          if (attempts > step.retries) {
            this.eventBus.emit('pipeline:step_error', { stepId: step.id, error: error instanceof Error ? error.message : String(error) });
            return err(new Error(`Step ${step.id} failed after ${attempts} attempts`));
          }
          logger.warn(`Step ${step.id} failed, retrying (${attempts}/${step.retries})`);
        }
      }
      this.currentStepIndex++;
    }
    this.eventBus.emit('pipeline:complete', { context });
    return ok(context);
  }

  getCurrentStep(): PipelineStep | null {
    if (this.currentStepIndex < 0 || this.currentStepIndex >= this.steps.length) return null;
    return this.steps[this.currentStepIndex];
  }

  getProgress(): { current: number; total: number; percentage: number } {
    const total = this.steps.length;
    const current = this.currentStepIndex + 1;
    return { current, total, percentage: total > 0 ? (current / total) * 100 : 0 };
  }

  clear(): void {
    this.steps = [];
    this.currentStepIndex = -1;
  }
}
