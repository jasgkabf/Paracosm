import type { ProviderConfig } from '@paracosm/shared';
import { MODEL_CAPABILITIES } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';
import type { RoutingContext } from './smart-router.js';

const logger = createLogger('ModelSelector');

export interface ModelSelectionCriteria {
  minContextWindow?: number;
  maxOutputTokens?: number;
  requiresStreaming?: boolean;
  requiresFunctionCalling?: boolean;
  requiresVision?: boolean;
  maxCostPer1kInput?: number;
  maxCostPer1kOutput?: number;
  preferredProvider?: string;
}

export class ModelSelector {
  private customCapabilities: Map<string, typeof MODEL_CAPABILITIES[string]> = new Map();

  selectBest(provider: ProviderConfig, context: RoutingContext): string {
    const candidates = provider.models.filter((model) => {
      return this.meetsRequirements(model, context);
    });

    if (candidates.length === 0) {
      logger.warn('No models meet requirements, using default', {
        provider: provider.provider,
        default: provider.defaultModel,
      });
      return provider.defaultModel;
    }

    if (candidates.length === 1) {
      return candidates[0];
    }

    const scored = candidates.map((model) => ({
      model,
      score: this.scoreModel(model, context),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored[0].model;
  }

  selectByCriteria(
    providers: ProviderConfig[],
    criteria: ModelSelectionCriteria,
  ): Array<{ provider: string; model: string; score: number }> {
    const results: Array<{ provider: string; model: string; score: number }> = [];

    for (const provider of providers) {
      for (const model of provider.models) {
        if (this.meetsCriteria(model, criteria)) {
          const score = this.scoreByCriteria(model, criteria);
          results.push({ provider: provider.provider, model, score });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  getModelCapabilities(model: string): typeof MODEL_CAPABILITIES[string] | null {
    const custom = this.customCapabilities.get(model);
    if (custom) return custom;

    const standard = MODEL_CAPABILITIES[model as keyof typeof MODEL_CAPABILITIES];
    return standard || null;
  }

  setCustomCapabilities(model: string, capabilities: typeof MODEL_CAPABILITIES[string]): void {
    this.customCapabilities.set(model, capabilities);
  }

  removeCustomCapabilities(model: string): void {
    this.customCapabilities.delete(model);
  }

  getContextWindow(model: string): number {
    const caps = this.getModelCapabilities(model);
    return caps?.contextWindow ?? 4096;
  }

  getMaxOutputTokens(model: string): number {
    const caps = this.getModelCapabilities(model);
    return caps?.maxOutputTokens ?? 4096;
  }

  supportsStreaming(model: string): boolean {
    const caps = this.getModelCapabilities(model);
    return caps?.streaming ?? true;
  }

  supportsFunctionCalling(model: string): boolean {
    const caps = this.getModelCapabilities(model);
    return caps?.functionCalling ?? false;
  }

  supportsVision(model: string): boolean {
    const caps = this.getModelCapabilities(model);
    return caps?.vision ?? false;
  }

  private meetsRequirements(model: string, context: RoutingContext): boolean {
    const caps = this.getModelCapabilities(model);
    if (!caps) return true;

    if (context.requiresVision && !caps.vision) return false;
    if (context.requiresFunctionCalling && !caps.functionCalling) return false;
    if (context.requiresStreaming && !caps.streaming) return false;
    if (context.promptTokens + context.maxTokens > caps.contextWindow) return false;
    if (context.maxTokens > caps.maxOutputTokens) return false;

    return true;
  }

  private meetsCriteria(model: string, criteria: ModelSelectionCriteria): boolean {
    const caps = this.getModelCapabilities(model);
    if (!caps) return true;

    if (criteria.minContextWindow && caps.contextWindow < criteria.minContextWindow) return false;
    if (criteria.maxOutputTokens && caps.maxOutputTokens < criteria.maxOutputTokens) return false;
    if (criteria.requiresStreaming && !caps.streaming) return false;
    if (criteria.requiresFunctionCalling && !caps.functionCalling) return false;
    if (criteria.requiresVision && !caps.vision) return false;
    if (criteria.maxCostPer1kInput && caps.costPer1kInput > criteria.maxCostPer1kInput) return false;
    if (criteria.maxCostPer1kOutput && caps.costPer1kOutput > criteria.maxCostPer1kOutput) return false;

    return true;
  }

  private scoreModel(model: string, context: RoutingContext): number {
    const caps = this.getModelCapabilities(model);
    if (!caps) return 50;

    let score = 50;

    const contextUtilization = (context.promptTokens + context.maxTokens) / caps.contextWindow;
    if (contextUtilization > 0.8) {
      score -= 10;
    } else if (contextUtilization > 0.5) {
      score += 5;
    } else {
      score += 10;
    }

    if (context.priority === 'high') {
      if (caps.costPer1kInput > 0.01) score += 10;
    } else if (context.priority === 'low') {
      if (caps.costPer1kInput < 0.001) score += 10;
    }

    if (context.budgetRemaining < 1) {
      if (caps.costPer1kInput < 0.001) score += 15;
      else if (caps.costPer1kInput > 0.01) score -= 15;
    }

    return score;
  }

  private scoreByCriteria(model: string, criteria: ModelSelectionCriteria): number {
    const caps = this.getModelCapabilities(model);
    if (!caps) return 0;

    let score = 0;

    if (criteria.minContextWindow) {
      const excess = caps.contextWindow - criteria.minContextWindow;
      score += Math.min(excess / 10000, 10);
    }

    if (criteria.preferredProvider) {
      score += 5;
    }

    score -= caps.costPer1kInput * 1000;
    score -= caps.costPer1kOutput * 1000;

    return score;
  }
}
