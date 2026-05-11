import type { StrategyGene } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('ContextAdaptation');

export interface AdaptationContext {
  taskType: string;
  complexity: 'low' | 'medium' | 'high';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  resourceConstraints: Record<string, number>;
  timeConstraints?: number;
  metadata: Record<string, unknown>;
}

export class ContextAdaptation {
  private contextHistory: Array<{ context: AdaptationContext; result: 'success' | 'failure'; timestamp: Date }> = [];

  adapt(gene: StrategyGene, context: AdaptationContext): StrategyGene {
    let adaptedValue = gene.value;
    let fitnessAdjustment = 0;
    const complexityMultiplier = { low: 0.8, medium: 1.0, high: 1.2 };
    const urgencyMultiplier = { low: 0.9, medium: 1.0, high: 1.1, critical: 1.3 };
    fitnessAdjustment *= complexityMultiplier[context.complexity];
    fitnessAdjustment *= urgencyMultiplier[context.urgency];
    if (typeof adaptedValue === 'number') {
      const resourceKey = gene.type;
      if (context.resourceConstraints[resourceKey] !== undefined) {
        const limit = context.resourceConstraints[resourceKey];
        adaptedValue = Math.min(adaptedValue as number, limit);
      }
    }
    if (context.timeConstraints && typeof adaptedValue === 'number') {
      const timeFactor = Math.min(context.timeConstraints / 1000, 1.5);
      adaptedValue = (adaptedValue as number) * timeFactor;
    }
    const similarContexts = this.contextHistory.filter(
      (h) => h.context.taskType === context.taskType && h.result === 'success',
    );
    if (similarContexts.length > 0) {
      fitnessAdjustment += 0.1;
    }
    return {
      ...gene,
      value: adaptedValue,
      fitness: Math.max(gene.fitness + fitnessAdjustment, 0),
      metadata: { ...gene.metadata, contextAdapted: true, taskType: context.taskType },
    };
  }

  recordOutcome(context: AdaptationContext, result: 'success' | 'failure'): void {
    this.contextHistory.push({ context, result, timestamp: new Date() });
    if (this.contextHistory.length > 1000) {
      this.contextHistory.shift();
    }
  }

  getContextualFitness(gene: StrategyGene, context: AdaptationContext): number {
    const adapted = this.adapt(gene, context);
    return adapted.fitness;
  }

  clear(): void {
    this.contextHistory = [];
  }
}
