import type { SimulationSnapshot, SimulationConfig } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';
import type { PredictionResult } from './types.js';

const logger = createLogger('Predictor');

export class Predictor {
  private config: SimulationConfig;
  private historicalOutcomes: Map<string, Array<{ input: Record<string, unknown>; output: string; success: boolean }>> = new Map();

  constructor(config: SimulationConfig) {
    this.config = config;
  }

  predict(currentState: Record<string, unknown>, context?: Record<string, unknown>): PredictionResult {
    const keyFactors = this.extractKeyFactors(currentState);
    const assumptions = this.generateAssumptions(currentState);
    const similarOutcomes = this.findSimilarOutcomes(currentState);
    let probability = 0.5;
    let confidence = 0.5;
    if (similarOutcomes.length > 0) {
      const successRate = similarOutcomes.filter((o) => o.success).length / similarOutcomes.length;
      probability = successRate;
      confidence = Math.min(similarOutcomes.length / 10, 1.0);
    }
    if (context) {
      const contextBoost = this.evaluateContext(context);
      probability = probability * 0.7 + contextBoost * 0.3;
    }
    const predictedOutcome = probability > 0.6 ? 'success' : probability > 0.3 ? 'partial' : 'failure';
    return {
      predictedOutcome,
      confidence,
      probability,
      keyFactors,
      assumptions,
    };
  }

  recordOutcome(taskType: string, input: Record<string, unknown>, output: string, success: boolean): void {
    const outcomes = this.historicalOutcomes.get(taskType) ?? [];
    outcomes.push({ input, output, success });
    if (outcomes.length > 1000) outcomes.shift();
    this.historicalOutcomes.set(taskType, outcomes);
  }

  private extractKeyFactors(state: Record<string, unknown>): string[] {
    const factors: string[] = [];
    for (const [key, value] of Object.entries(state)) {
      if (typeof value === 'number' && value > 0) {
        factors.push(key);
      } else if (typeof value === 'boolean' && value) {
        factors.push(key);
      } else if (typeof value === 'string' && value.length > 0) {
        factors.push(key);
      }
    }
    return factors.slice(0, 10);
  }

  private generateAssumptions(state: Record<string, unknown>): string[] {
    const assumptions: string[] = [];
    assumptions.push('Current state remains stable during execution');
    if (!('errorRate' in state)) {
      assumptions.push('Error rate remains within normal bounds');
    }
    if (!('resourceAvailability' in state)) {
      assumptions.push('Sufficient resources are available');
    }
    assumptions.push('External dependencies remain accessible');
    return assumptions;
  }

  private findSimilarOutcomes(state: Record<string, unknown>): Array<{ input: Record<string, unknown>; output: string; success: boolean }> {
    const allOutcomes: Array<{ input: Record<string, unknown>; output: string; success: boolean }> = [];
    for (const [, outcomes] of this.historicalOutcomes) {
      allOutcomes.push(...outcomes);
    }
    return allOutcomes.filter((outcome) => {
      const commonKeys = Object.keys(outcome.input).filter((k) => k in state);
      if (commonKeys.length === 0) return false;
      let matches = 0;
      for (const key of commonKeys) {
        if (JSON.stringify(outcome.input[key]) === JSON.stringify(state[key])) matches++;
      }
      return matches / commonKeys.length >= 0.5;
    });
  }

  private evaluateContext(context: Record<string, unknown>): number {
    let score = 0.5;
    if ('priority' in context) {
      const priority = context.priority as string;
      if (priority === 'critical' || priority === 'high') score += 0.1;
    }
    if ('complexity' in context) {
      const complexity = context.complexity as string;
      if (complexity === 'low') score += 0.15;
      else if (complexity === 'high') score -= 0.1;
    }
    return Math.min(Math.max(score, 0), 1);
  }
}
