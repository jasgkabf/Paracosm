import type { LLMModel, LLMModelCapabilities } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";

const logger = new Logger("ModelSelector");

export interface ModelFilter {
  minContextWindow?: number;
  maxContextWindow?: number;
  requireStreaming?: boolean;
  requireFunctionCalling?: boolean;
  requireVision?: boolean;
  requireEmbeddings?: boolean;
  requireJsonMode?: boolean;
  maxInputCostPerToken?: number;
  maxOutputCostPerToken?: number;
  minAvailability?: number;
  providerId?: string;
}

export interface ModelComparison {
  modelA: LLMModel;
  modelB: LLMModel;
  contextWindowDiff: number;
  costDiff: number;
  latencyDiff: number;
  capabilityDiff: string[];
  recommendation: "A" | "B" | "neutral";
}

const TASK_TYPE_WEIGHTS: Record<string, Record<string, number>> = {
  simple_chat: { cost: 0.4, speed: 0.3, quality: 0.2, context: 0.1 },
  code_generation: { cost: 0.2, speed: 0.2, quality: 0.4, context: 0.2 },
  complex_reasoning: { cost: 0.1, speed: 0.1, quality: 0.5, context: 0.3 },
  simulation: { cost: 0.15, speed: 0.2, quality: 0.4, context: 0.25 },
  persona_debate: { cost: 0.1, speed: 0.15, quality: 0.45, context: 0.3 },
  creative: { cost: 0.2, speed: 0.15, quality: 0.45, context: 0.2 },
  analysis: { cost: 0.15, speed: 0.2, quality: 0.4, context: 0.25 },
};

export class ModelSelector {
  select(models: LLMModel[], filter: ModelFilter): LLMModel[] {
    return this.filter(models, filter);
  }

  filter(models: LLMModel[], filter: ModelFilter): LLMModel[] {
    return models.filter((model) => {
      if (filter.minContextWindow !== undefined && model.contextWindow < filter.minContextWindow) {
        return false;
      }
      if (filter.maxContextWindow !== undefined && model.contextWindow > filter.maxContextWindow) {
        return false;
      }
      if (filter.requireStreaming && !model.capabilities.streaming) {
        return false;
      }
      if (filter.requireFunctionCalling && !model.capabilities.functionCalling) {
        return false;
      }
      if (filter.requireVision && !model.capabilities.vision) {
        return false;
      }
      if (filter.requireEmbeddings && !model.capabilities.embeddings) {
        return false;
      }
      if (filter.requireJsonMode && !model.capabilities.jsonMode) {
        return false;
      }
      if (filter.maxInputCostPerToken !== undefined && model.inputCostPerToken > filter.maxInputCostPerToken) {
        return false;
      }
      if (filter.maxOutputCostPerToken !== undefined && model.outputCostPerToken > filter.maxOutputCostPerToken) {
        return false;
      }
      if (filter.minAvailability !== undefined && model.availability < filter.minAvailability) {
        return false;
      }
      if (filter.providerId !== undefined && model.providerId !== filter.providerId) {
        return false;
      }
      return true;
    });
  }

  rank(models: LLMModel[], taskType: string): LLMModel[] {
    const weights = TASK_TYPE_WEIGHTS[taskType] ?? TASK_TYPE_WEIGHTS.simple_chat;
    const scored = models.map((model) => ({
      model,
      score: this.computeScore(model, weights),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.model);
  }

  compare(modelA: LLMModel, modelB: LLMModel): ModelComparison {
    const contextWindowDiff = modelA.contextWindow - modelB.contextWindow;
    const costDiff = (modelA.inputCostPerToken + modelA.outputCostPerToken) - (modelB.inputCostPerToken + modelB.outputCostPerToken);
    const latencyDiff = modelA.latencyMs - modelB.latencyMs;

    const capabilityDiff: string[] = [];
    const capA = modelA.capabilities;
    const capB = modelB.capabilities;

    if (capA.streaming !== capB.streaming) capabilityDiff.push("streaming");
    if (capA.functionCalling !== capB.functionCalling) capabilityDiff.push("functionCalling");
    if (capA.vision !== capB.vision) capabilityDiff.push("vision");
    if (capA.jsonMode !== capB.jsonMode) capabilityDiff.push("jsonMode");
    if (capA.embeddings !== capB.embeddings) capabilityDiff.push("embeddings");

    let scoreA = 0;
    let scoreB = 0;
    if (contextWindowDiff > 0) scoreA++; else if (contextWindowDiff < 0) scoreB++;
    if (costDiff < 0) scoreA++; else if (costDiff > 0) scoreB++;
    if (latencyDiff < 0) scoreA++; else if (latencyDiff > 0) scoreB++;

    let recommendation: "A" | "B" | "neutral" = "neutral";
    if (scoreA > scoreB + 1) recommendation = "A";
    else if (scoreB > scoreA + 1) recommendation = "B";

    return {
      modelA,
      modelB,
      contextWindowDiff,
      costDiff,
      latencyDiff,
      capabilityDiff,
      recommendation,
    };
  }

  recommend(models: LLMModel[], taskType: string, budgetUsd?: number): LLMModel[] {
    const filtered = budgetUsd !== undefined
      ? models.filter((m) => m.inputCostPerToken * 1000 + m.outputCostPerToken * 1000 <= budgetUsd)
      : models;

    return this.rank(filtered, taskType);
  }

  scoreForTask(model: LLMModel, taskType: string): number {
    const weights = TASK_TYPE_WEIGHTS[taskType] ?? TASK_TYPE_WEIGHTS.simple_chat;
    return this.computeScore(model, weights);
  }

  private computeScore(model: LLMModel, weights: Record<string, number>): number {
    let score = 0;

    const maxContext = 200000;
    const contextNorm = Math.min(model.contextWindow / maxContext, 1);
    score += contextNorm * (weights.context ?? 0);

    const maxCost = 0.0001;
    const costNorm = 1 - Math.min((model.inputCostPerToken + model.outputCostPerToken) / maxCost, 1);
    score += costNorm * (weights.cost ?? 0);

    const maxLatency = 60000;
    const latencyNorm = 1 - Math.min(model.latencyMs / maxLatency, 1);
    score += latencyNorm * (weights.speed ?? 0);

    let qualityScore = 0.5;
    if (model.capabilities.functionCalling) qualityScore += 0.1;
    if (model.capabilities.vision) qualityScore += 0.05;
    if (model.capabilities.jsonMode) qualityScore += 0.05;
    if (model.capabilities.maxOutputTokens > 8192) qualityScore += 0.1;
    qualityScore += model.availability * 0.1;
    score += Math.min(qualityScore, 1) * (weights.quality ?? 0);

    return score;
  }
}
