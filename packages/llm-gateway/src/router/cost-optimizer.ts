import { MODEL_CAPABILITIES, MODEL_PRICING } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('CostOptimizer');

export interface CostEstimate {
  provider: string;
  model: string;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

export interface CostOptimizationResult {
  recommendedProvider: string;
  recommendedModel: string;
  estimatedCost: number;
  savings: number;
  savingsPercent: number;
  alternatives: CostEstimate[];
}

export class CostOptimizer {
  private customPricing: Map<string, { inputPer1k: number; outputPer1k: number }> = new Map();
  private dailySpend: number = 0;
  private monthlySpend: number = 0;

  estimateCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const pricing = this.getPricing(model);
    if (!pricing) {
      logger.warn('No pricing data for model', { model });
      return 0;
    }

    const inputCost = (inputTokens / 1000) * pricing.inputPer1k;
    const outputCost = (outputTokens / 1000) * pricing.outputPer1k;
    return inputCost + outputCost;
  }

  detailedEstimate(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): CostEstimate {
    const pricing = this.getPricing(model);
    const inputCost = pricing ? (inputTokens / 1000) * pricing.inputPer1k : 0;
    const outputCost = pricing ? (outputTokens / 1000) * pricing.outputPer1k : 0;

    return {
      provider,
      model,
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: 'USD',
    };
  }

  optimize(
    providers: Array<{ provider: string; models: string[] }>,
    inputTokens: number,
    outputTokens: number,
    maxCost?: number,
  ): CostOptimizationResult {
    const estimates: CostEstimate[] = [];

    for (const p of providers) {
      for (const model of p.models) {
        const estimate = this.detailedEstimate(p.provider, model, inputTokens, outputTokens);
        if (!maxCost || estimate.totalCost <= maxCost) {
          estimates.push(estimate);
        }
      }
    }

    estimates.sort((a, b) => a.totalCost - b.totalCost);

    if (estimates.length === 0) {
      return {
        recommendedProvider: providers[0]?.provider || 'openai',
        recommendedModel: providers[0]?.models[0] || 'gpt-4o-mini',
        estimatedCost: 0,
        savings: 0,
        savingsPercent: 0,
        alternatives: [],
      };
    }

    const cheapest = estimates[0];
    const mostExpensive = estimates[estimates.length - 1];
    const savings = mostExpensive.totalCost - cheapest.totalCost;
    const savingsPercent = mostExpensive.totalCost > 0
      ? (savings / mostExpensive.totalCost) * 100
      : 0;

    return {
      recommendedProvider: cheapest.provider,
      recommendedModel: cheapest.model,
      estimatedCost: cheapest.totalCost,
      savings,
      savingsPercent,
      alternatives: estimates.slice(1, 5),
    };
  }

  setCustomPricing(model: string, inputPer1k: number, outputPer1k: number): void {
    this.customPricing.set(model, { inputPer1k, outputPer1k });
  }

  removeCustomPricing(model: string): void {
    this.customPricing.delete(model);
  }

  recordSpend(cost: number): void {
    this.dailySpend += cost;
    this.monthlySpend += cost;
  }

  getDailySpend(): number {
    return this.dailySpend;
  }

  getMonthlySpend(): number {
    return this.monthlySpend;
  }

  resetDailySpend(): void {
    this.dailySpend = 0;
  }

  resetMonthlySpend(): void {
    this.monthlySpend = 0;
  }

  isWithinBudget(
    cost: number,
    dailyLimit: number,
    monthlyLimit: number,
  ): { allowed: boolean; reason?: string } {
    if (this.dailySpend + cost > dailyLimit) {
      return {
        allowed: false,
        reason: `Daily budget would be exceeded ($${(this.dailySpend + cost).toFixed(4)} > $${dailyLimit})`,
      };
    }
    if (this.monthlySpend + cost > monthlyLimit) {
      return {
        allowed: false,
        reason: `Monthly budget would be exceeded ($${(this.monthlySpend + cost).toFixed(4)} > $${monthlyLimit})`,
      };
    }
    return { allowed: true };
  }

  private getPricing(model: string): { inputPer1k: number; outputPer1k: number } | null {
    const custom = this.customPricing.get(model);
    if (custom) return custom;

    const standard = MODEL_PRICING[model as keyof typeof MODEL_PRICING];
    if (standard) return standard;

    return null;
  }

  compareModels(
    models: Array<{ provider: string; model: string }>,
    inputTokens: number,
    outputTokens: number,
  ): CostEstimate[] {
    return models.map((m) =>
      this.detailedEstimate(m.provider, m.model, inputTokens, outputTokens),
    ).sort((a, b) => a.totalCost - b.totalCost);
  }

  calculateBatchCost(
    requests: Array<{ model: string; inputTokens: number; outputTokens: number }>,
  ): number {
    return requests.reduce((total, req) => {
      return total + this.estimateCost('', req.model, req.inputTokens, req.outputTokens);
    }, 0);
  }
}
