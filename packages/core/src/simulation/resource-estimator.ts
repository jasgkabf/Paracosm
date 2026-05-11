import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { SimulationError } from "@paracosm/shared";
import type {
  TokenEstimate,
  TimeEstimate,
  CostEstimate,
  MemoryEstimate,
  ResourceBudget,
  OptimizedPlan,
  PathNode,
} from "./types.js";

interface ModelPricing {
  inputTokenCost: number;
  outputTokenCost: number;
  currency: string;
}

const DEFAULT_MODEL_PRICING: ModelPricing = {
  inputTokenCost: 0.00003,
  outputTokenCost: 0.00006,
  currency: "USD",
};

export class ResourceEstimator {
  private pricing: ModelPricing;
  private budget: ResourceBudget | null;
  private historicalUsage: Array<{
    action: string;
    tokens: number;
    timeMs: number;
    costUsd: number;
    memoryBytes: number;
  }>;

  constructor(pricing?: Partial<ModelPricing>, budget?: ResourceBudget | null) {
    this.pricing = { ...DEFAULT_MODEL_PRICING, ...pricing };
    this.budget = budget ?? null;
    this.historicalUsage = [];
  }

  estimateTokens(action: PathNode): TokenEstimate {
    const baseInputTokens = this.estimateInputTokens(action);
    const baseOutputTokens = this.estimateOutputTokens(action);

    const paramComplexity = this.computeParameterComplexity(action.parameters);
    const inputTokens = Math.floor(baseInputTokens * (1 + paramComplexity * 0.5));
    const outputTokens = Math.floor(baseOutputTokens * (1 + paramComplexity * 0.3));

    const historicalAdjustment = this.getHistoricalTokenAdjustment(action.action);
    const adjustedInput = Math.floor(inputTokens * historicalAdjustment);
    const adjustedOutput = Math.floor(outputTokens * historicalAdjustment);

    const totalTokens = adjustedInput + adjustedOutput;
    const estimatedCostUsd =
      adjustedInput * this.pricing.inputTokenCost +
      adjustedOutput * this.pricing.outputTokenCost;

    return {
      inputTokens: adjustedInput,
      outputTokens: adjustedOutput,
      totalTokens,
      estimatedCostUsd,
    };
  }

  estimateTime(action: PathNode): TimeEstimate {
    const baseTime = this.computeBaseTime(action.action);
    const complexityMultiplier = this.computeComplexityMultiplier(action);
    const expectedMs = baseTime * complexityMultiplier;

    const historicalAdjustment = this.getHistoricalTimeAdjustment(action.action);

    return {
      minimumMs: Math.floor(expectedMs * 0.5 * historicalAdjustment),
      expectedMs: Math.floor(expectedMs * historicalAdjustment),
      maximumMs: Math.floor(expectedMs * 2.0 * historicalAdjustment),
      confidence: this.computeTimeConfidence(action),
    };
  }

  estimateCost(action: PathNode, modelPricing?: ModelPricing): CostEstimate {
    const pricing = modelPricing ?? this.pricing;
    const tokenEstimate = this.estimateTokens(action);
    const timeEstimate = this.estimateTime(action);

    const tokenCost = tokenEstimate.estimatedCostUsd;
    const computeCost = timeEstimate.expectedMs * 0.000001;
    const totalExpected = tokenCost + computeCost;

    const breakdown = new Map<string, number>();
    breakdown.set("input_tokens", tokenEstimate.inputTokens * pricing.inputTokenCost);
    breakdown.set("output_tokens", tokenEstimate.outputTokens * pricing.outputTokenCost);
    breakdown.set("compute", computeCost);
    breakdown.set("overhead", totalExpected * 0.05);

    return {
      minimum: totalExpected * 0.5,
      expected: totalExpected,
      maximum: totalExpected * 2.5,
      confidence: this.computeCostConfidence(action),
      breakdown,
    };
  }

  estimateMemory(action: PathNode): MemoryEstimate {
    const baseMemory = this.computeBaseMemory(action.action);
    const paramSize = this.computeParameterSize(action.parameters);
    const stateDeltaSize = this.computeStateDeltaSize(action.stateDelta);

    const expectedBytes = baseMemory + paramSize + stateDeltaSize;

    return {
      minimumBytes: Math.floor(expectedBytes * 0.7),
      expectedBytes: Math.floor(expectedBytes),
      maximumBytes: Math.floor(expectedBytes * 2.0),
      confidence: 0.7,
    };
  }

  optimizeResource(budget: ResourceBudget, actions: PathNode[]): Result<OptimizedPlan, SimulationError> {
    const actionEstimates = actions.map((action) => {
      const tokens = this.estimateTokens(action);
      const time = this.estimateTime(action);
      const cost = this.estimateCost(action);
      const memory = this.estimateMemory(action);

      return {
        action: action.action,
        parameters: action.parameters,
        estimatedTokens: tokens.totalTokens,
        estimatedTimeMs: time.expectedMs,
        estimatedCostUsd: cost.expected,
        estimatedMemoryBytes: memory.expectedBytes,
        priority: this.computeActionPriority(action),
      };
    });

    const sorted = [...actionEstimates].sort((a, b) => b.priority - a.priority);

    const selected: typeof actionEstimates = [];
    let totalTokens = 0;
    let totalTimeMs = 0;
    let totalCostUsd = 0;
    let totalMemoryBytes = 0;

    for (const estimate of sorted) {
      const newTokens = totalTokens + estimate.estimatedTokens;
      const newTime = totalTimeMs + estimate.estimatedTimeMs;
      const newCost = totalCostUsd + estimate.estimatedCostUsd;
      const newMemory = totalMemoryBytes + estimate.estimatedMemoryBytes;

      if (newTokens <= budget.maxTokens &&
          newTime <= budget.maxTimeMs &&
          newCost <= budget.maxCostUsd &&
          newMemory <= budget.maxMemoryBytes) {
        selected.push(estimate);
        totalTokens = newTokens;
        totalTimeMs = newTime;
        totalCostUsd = newCost;
        totalMemoryBytes = newMemory;
      }
    }

    const withinBudget = totalTokens <= budget.maxTokens &&
      totalTimeMs <= budget.maxTimeMs &&
      totalCostUsd <= budget.maxCostUsd &&
      totalMemoryBytes <= budget.maxMemoryBytes;

    const savings = new Map<string, number>();
    savings.set("tokens", budget.maxTokens - totalTokens);
    savings.set("time_ms", budget.maxTimeMs - totalTimeMs);
    savings.set("cost_usd", budget.maxCostUsd - totalCostUsd);
    savings.set("memory_bytes", budget.maxMemoryBytes - totalMemoryBytes);

    return ok({
      actions: selected,
      totalTokens,
      totalTimeMs,
      totalCostUsd,
      totalMemoryBytes,
      withinBudget,
      savings,
    });
  }

  setBudget(budget: ResourceBudget): void {
    this.budget = budget;
  }

  getBudget(): ResourceBudget | null {
    return this.budget;
  }

  setPricing(pricing: Partial<ModelPricing>): void {
    this.pricing = { ...this.pricing, ...pricing };
  }

  getPricing(): ModelPricing {
    return { ...this.pricing };
  }

  recordUsage(action: string, tokens: number, timeMs: number, costUsd: number, memoryBytes: number): void {
    this.historicalUsage.push({ action, tokens, timeMs, costUsd, memoryBytes });
    if (this.historicalUsage.length > 1000) {
      this.historicalUsage.shift();
    }
  }

  private estimateInputTokens(action: PathNode): number {
    const baseTokens: Record<string, number> = {
      create: 200,
      update: 300,
      delete: 150,
      query: 250,
      transform: 400,
      merge: 350,
      split: 300,
      validate: 200,
    };

    return baseTokens[action.action] ?? 250;
  }

  private estimateOutputTokens(action: PathNode): number {
    const baseTokens: Record<string, number> = {
      create: 100,
      update: 150,
      delete: 50,
      query: 200,
      transform: 250,
      merge: 200,
      split: 200,
      validate: 100,
    };

    return baseTokens[action.action] ?? 100;
  }

  private computeParameterComplexity(params: Record<string, unknown>): number {
    const jsonStr = JSON.stringify(params);
    return Math.min(1, jsonStr.length / 500);
  }

  private getHistoricalTokenAdjustment(action: string): number {
    const related = this.historicalUsage.filter((h) => h.action === action);
    if (related.length === 0) return 1.0;

    const avgTokens = related.reduce((s, h) => s + h.tokens, 0) / related.length;
    const estimatedTokens = (this.estimateInputTokens({ action } as PathNode) + this.estimateOutputTokens({ action } as PathNode));

    if (estimatedTokens === 0) return 1.0;
    return 0.7 + (avgTokens / estimatedTokens) * 0.3;
  }

  private getHistoricalTimeAdjustment(action: string): number {
    const related = this.historicalUsage.filter((h) => h.action === action);
    if (related.length === 0) return 1.0;

    const avgTime = related.reduce((s, h) => s + h.timeMs, 0) / related.length;
    const estimatedTime = this.computeBaseTime(action);

    if (estimatedTime === 0) return 1.0;
    return 0.7 + (avgTime / estimatedTime) * 0.3;
  }

  private computeBaseTime(action: string): number {
    const baseTimes: Record<string, number> = {
      create: 500,
      update: 400,
      delete: 300,
      query: 200,
      transform: 800,
      merge: 600,
      split: 600,
      validate: 300,
    };

    return baseTimes[action] ?? 400;
  }

  private computeComplexityMultiplier(action: PathNode): number {
    let multiplier = 1.0;

    const paramCount = Object.keys(action.parameters).length;
    multiplier += paramCount * 0.1;

    const stateDeltaSize = Object.keys(action.stateDelta).length;
    multiplier += stateDeltaSize * 0.05;

    if (action.risk > 0.5) multiplier += 0.2;
    if (action.cost > 1.0) multiplier += 0.3;

    return multiplier;
  }

  private computeTimeConfidence(action: PathNode): number {
    const related = this.historicalUsage.filter((h) => h.action === action.action);
    if (related.length < 3) return 0.4;
    if (related.length < 10) return 0.6;
    if (related.length < 30) return 0.8;
    return 0.9;
  }

  private computeCostConfidence(action: PathNode): number {
    const related = this.historicalUsage.filter((h) => h.action === action.action);
    if (related.length < 3) return 0.3;
    if (related.length < 10) return 0.5;
    if (related.length < 30) return 0.7;
    return 0.85;
  }

  private computeBaseMemory(action: string): number {
    const baseMemory: Record<string, number> = {
      create: 1024 * 100,
      update: 1024 * 80,
      delete: 1024 * 50,
      query: 1024 * 120,
      transform: 1024 * 200,
      merge: 1024 * 150,
      split: 1024 * 150,
      validate: 1024 * 80,
    };

    return baseMemory[action] ?? 1024 * 100;
  }

  private computeParameterSize(params: Record<string, unknown>): number {
    const jsonStr = JSON.stringify(params);
    return jsonStr.length * 2;
  }

  private computeStateDeltaSize(stateDelta: Record<string, unknown>): number {
    const jsonStr = JSON.stringify(stateDelta);
    return jsonStr.length * 2;
  }

  private computeActionPriority(action: PathNode): number {
    let priority = 0.5;

    if (action.action === "create" || action.action === "update") {
      priority += 0.2;
    }

    if (action.risk < 0.3) {
      priority += 0.1;
    }

    if (action.cost < 0.5) {
      priority += 0.1;
    }

    if (action.duration < 500) {
      priority += 0.1;
    }

    return Math.min(1, priority);
  }
}
