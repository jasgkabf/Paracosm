import type { ToolResult, ToolId } from '@paracosm/shared';
import { ok, err, type Result, createLogger } from '@paracosm/shared';
import { ToolExecutor } from './tool-executor.js';
import type { ToolExecutionContext, CompositionStep, CompositionResult } from './types.js';

const logger = createLogger('ToolComposer');

export class ToolComposer {
  private executor: ToolExecutor;

  constructor(executor: ToolExecutor) {
    this.executor = executor;
  }

  async compose(steps: CompositionStep[], initialInput: Record<string, unknown>, context: ToolExecutionContext): Promise<Result<CompositionResult>> {
    const startTime = Date.now();
    const results: ToolResult[] = [];
    let currentData: Record<string, unknown> = { ...initialInput };
    let success = true;

    for (const step of steps) {
      if (step.condition) {
        try {
          const shouldExecute = new Function('data', `with(data) { return ${step.condition}; }`)(currentData);
          if (!shouldExecute) continue;
        } catch {
          continue;
        }
      }
      const stepInput: Record<string, unknown> = {};
      for (const [key, mapping] of Object.entries(step.inputMapping)) {
        stepInput[key] = this.resolveMapping(mapping, currentData);
      }
      const result = await this.executor.execute(step.toolId, stepInput, context);
      if (!result.ok) {
        success = false;
        break;
      }
      results.push(result.value);
      if (result.value.success) {
        currentData[step.outputKey] = result.value.output;
      } else {
        success = false;
        currentData[`${step.outputKey}_error`] = result.value.error;
        break;
      }
    }

    return ok({
      steps,
      results,
      finalOutput: currentData,
      duration: Date.now() - startTime,
      success,
    });
  }

  private resolveMapping(mapping: string, data: Record<string, unknown>): unknown {
    if (!mapping.startsWith('$')) return mapping;
    const path = mapping.slice(1).split('.');
    let current: unknown = data;
    for (const key of path) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return current;
  }
}
