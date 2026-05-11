import type { LLMModel } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";

const logger = new Logger("CostOptimizer");

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ValueScore {
  modelId: string;
  costPerQualityUnit: number;
  estimatedCost: number;
  qualityEstimate: number;
}

export class CostOptimizer {
  private pricingCache: Map<string, { inputPerToken: number; outputPerToken: number }> = new Map();
  private historicalCosts: Map<string, CostEstimate[]> = new Map();

  estimateCost(model: LLMModel, estimatedTokens: { input: number; output: number }): number {
    const pricing = this.getModelPricing(model);
    const inputCost = estimatedTokens.input * pricing.inputPerToken;
    const outputCost = estimatedTokens.output * pricing.outputPerToken;
    return inputCost + outputCost;
  }

  estimateCostDetailed(model: LLMModel, estimatedTokens: { input: number; output: number }): CostEstimate {
    const pricing = this.getModelPricing(model);
    const inputCost = estimatedTokens.input * pricing.inputPerToken;
    const outputCost = estimatedTokens.output * pricing.outputPerToken;
    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      inputTokens: estimatedTokens.input,
      outputTokens: estimatedTokens.output,
    };
  }

  findCheapest(models: LLMModel[], estimatedTokens: { input: number; output: number }): LLMModel | null {
    if (models.length === 0) {
      return null;
    }
    let cheapest: LLMModel | null = null;
    let cheapestCost = Infinity;
    for (const model of models) {
      const cost = this.estimateCost(model, estimatedTokens);
      if (cost < cheapestCost) {
        cheapestCost = cost;
        cheapest = model;
      }
    }
    return cheapest;
  }

  findBestValue(models: LLMModel[], estimatedTokens: { input: number; output: number }, qualityWeights?: Map<string, number>): LLMModel | null {
    if (models.length === 0) {
      return null;
    }
    const scores = models.map((model) => {
      const cost = this.estimateCost(model, estimatedTokens);
      const qualityEstimate = this.estimateQuality(model, qualityWeights);
      const costPerQuality = cost > 0 ? cost / qualityEstimate : Infinity;
      return { model, costPerQuality, estimatedCost: cost, qualityEstimate };
    });

    scores.sort((a, b) => a.costPerQuality - b.costPerQuality);
    return scores[0]?.model ?? null;
  }

  budgetConstrained(models: LLMModel[], estimatedTokens: { input: number; output: number }, budgetUsd: number): LLMModel[] {
    const affordable = models.filter((model) => {
      const cost = this.estimateCost(model, estimatedTokens);
      return cost <= budgetUsd;
    });

    affordable.sort((a, b) => {
      const costA = this.estimateCost(a, estimatedTokens);
      const costB = this.estimateCost(b, estimatedTokens);
      return costA - costB;
    });

    return affordable;
  }

  rankByCost(models: LLMModel[], estimatedTokens: { input: number; output: number }): { model: LLMModel; cost: number }[] {
    return models
      .map((model) => ({
        model,
        cost: this.estimateCost(model, estimatedTokens),
      }))
      .sort((a, b) => a.cost - b.cost);
  }

  getProjectedDailyCost(model: LLMModel, requestsPerDay: number, avgTokensPerRequest: { input: number; output: number }): number {
    const costPerRequest = this.estimateCost(model, avgTokensPerRequest);
    return costPerRequest * requestsPerDay;
  }

  getProjectedMonthlyCost(model: LLMModel, requestsPerDay: number, avgTokensPerRequest: { input: number; output: number }): number {
    const dailyCost = this.getProjectedDailyCost(model, requestsPerDay, avgTokensPerRequest);
    return dailyCost * 30;
  }

  recordActualCost(modelId: string, estimate: CostEstimate): void {
    if (!this.historicalCosts.has(modelId)) {
      this.historicalCosts.set(modelId, []);
    }
    const history = this.historicalCosts.get(modelId)!;
    history.push(estimate);
    if (history.length > 100) {
      history.shift();
    }
  }

  getAverageCost(modelId: string): number | null {
    const history = this.historicalCosts.get(modelId);
    if (!history || history.length === 0) {
      return null;
    }
    const total = history.reduce((sum, e) => sum + e.totalCost, 0);
    return total / history.length;
  }

  private getModelPricing(model: LLMModel): { inputPerToken: number; outputPerToken: number } {
    const cached = this.pricingCache.get(model.modelId);
    if (cached) {
      return cached;
    }
    const pricing = {
      inputPerToken: model.inputCostPerToken,
      outputPerToken: model.outputCostPerToken,
    };
    this.pricingCache.set(model.modelId, pricing);
    return pricing;
  }

  private estimateQuality(model: LLMModel, weights?: Map<string, number>): number {
    let quality = 0.5;
    const caps = model.capabilities;

    if (caps.functionCalling) quality += 0.1;
    if (caps.vision) quality += 0.05;
    if (caps.jsonMode) quality += 0.05;
    if (caps.maxOutputTokens > 8192) quality += 0.1;
    if (caps.maxInputTokens > 64000) quality += 0.1;

    quality += Math.min(model.contextWindow / 200000, 0.2);

    if (weights) {
      const weight = weights.get(model.modelId);
      if (weight !== undefined) {
        quality = quality * (1 + weight);
      }
    }

    return Math.min(quality, 1);
  }
}
