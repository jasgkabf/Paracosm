import type { LLMRequest, LLMResponse, LLMStreamChunk, ProviderConfig, RoutingRule } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';
import { TaskClassifier } from './task-classifier.js';
import { CostOptimizer } from './cost-optimizer.js';
import { LoadBalancer } from './load-balancer.js';
import { LatencyOptimizer } from './latency-optimizer.js';
import { RoutingRules } from './routing-rules.js';
import { RoutingAnalytics } from './routing-analytics.js';
import { ModelSelector } from './model-selector.js';
import { ContextFitter } from './context-fitter.js';
import { TokenEstimator } from './token-estimator.js';
import type { ConfigFile } from '../config/config-manager.js';

const logger = createLogger('SmartRouter');

export interface RoutingDecision {
  provider: string;
  model: string;
  reason: string;
  estimatedCost: number;
  estimatedLatency: number;
  alternatives: Array<{ provider: string; model: string; reason: string }>;
}

export interface RoutingContext {
  taskType: string;
  promptTokens: number;
  maxTokens: number;
  priority: 'low' | 'medium' | 'high';
  requiresStreaming: boolean;
  requiresVision: boolean;
  requiresFunctionCalling: boolean;
  budgetRemaining: number;
  metadata: Record<string, unknown>;
}

export class SmartRouter {
  private config: ConfigFile;
  private taskClassifier: TaskClassifier;
  private costOptimizer: CostOptimizer;
  private loadBalancer: LoadBalancer;
  private latencyOptimizer: LatencyOptimizer;
  private routingRules: RoutingRules;
  private analytics: RoutingAnalytics;
  private modelSelector: ModelSelector;
  private contextFitter: ContextFitter;
  private tokenEstimator: TokenEstimator;
  private providerHealth: Map<string, { available: boolean; latencyMs: number; errorRate: number }> = new Map();

  constructor(config: ConfigFile) {
    this.config = config;
    this.taskClassifier = new TaskClassifier();
    this.costOptimizer = new CostOptimizer();
    this.loadBalancer = new LoadBalancer();
    this.latencyOptimizer = new LatencyOptimizer();
    this.routingRules = new RoutingRules(config.routing.rules);
    this.analytics = new RoutingAnalytics();
    this.modelSelector = new ModelSelector();
    this.contextFitter = new ContextFitter();
    this.tokenEstimator = new TokenEstimator();

    for (const provider of config.providers) {
      this.providerHealth.set(provider.provider, {
        available: true,
        latencyMs: 0,
        errorRate: 0,
      });
    }
  }

  route(request: LLMRequest): RoutingDecision {
    const context = this.buildRoutingContext(request);
    const strategy = this.config.routing.strategy;

    let decision: RoutingDecision;

    const ruleMatch = this.routingRules.match(context);
    if (ruleMatch && strategy !== 'round_robin') {
      decision = this.applyRuleDecision(ruleMatch, context);
      logger.info('Routing decision from rule', {
        rule: ruleMatch.name,
        provider: decision.provider,
        model: decision.model,
      });
    } else {
      switch (strategy) {
        case 'round_robin':
          decision = this.routeRoundRobin(context);
          break;
        case 'least_latency':
          decision = this.routeLeastLatency(context);
          break;
        case 'cost_optimized':
          decision = this.routeCostOptimized(context);
          break;
        case 'quality_optimized':
          decision = this.routeQualityOptimized(context);
          break;
        case 'adaptive':
          decision = this.routeAdaptive(context);
          break;
        case 'manual':
          decision = this.routeManual(context);
          break;
        default:
          decision = this.routeDefault(context);
      }
    }

    if (!this.isProviderAvailable(decision.provider)) {
      decision = this.findAlternative(decision, context);
    }

    decision.alternatives = this.generateAlternatives(decision, context);

    this.analytics.recordDecision(decision, context);

    return decision;
  }

  updateProviderHealth(
    provider: string,
    health: { available: boolean; latencyMs: number; errorRate: number },
  ): void {
    this.providerHealth.set(provider, health);
    this.latencyOptimizer.updateLatency(provider, health.latencyMs);
  }

  getAnalytics(): RoutingAnalytics {
    return this.analytics;
  }

  private buildRoutingContext(request: LLMRequest): RoutingContext {
    const taskType = this.taskClassifier.classify(request.prompt, request.metadata);
    const promptTokens = this.tokenEstimator.estimateTokens(request.prompt);
    const maxTokens = request.maxTokens ?? 4096;

    return {
      taskType,
      promptTokens,
      maxTokens,
      priority: (request.metadata.priority as RoutingContext['priority']) ?? 'medium',
      requiresStreaming: (request.metadata.streaming as boolean) ?? false,
      requiresVision: (request.metadata.vision as boolean) ?? false,
      requiresFunctionCalling: (request.metadata.functionCalling as boolean) ?? false,
      budgetRemaining: (request.metadata.budgetRemaining as number) ?? Infinity,
      metadata: request.metadata,
    };
  }

  private routeRoundRobin(context: RoutingContext): RoutingDecision {
    const provider = this.loadBalancer.next(this.config.providers);
    const model = this.modelSelector.selectBest(provider, context);
    const cost = this.costOptimizer.estimateCost(provider.provider, model, context.promptTokens, context.maxTokens);
    const latency = this.latencyOptimizer.estimateLatency(provider.provider, model);

    return {
      provider: provider.provider,
      model,
      reason: 'Round-robin load balancing',
      estimatedCost: cost,
      estimatedLatency: latency,
      alternatives: [],
    };
  }

  private routeLeastLatency(context: RoutingContext): RoutingDecision {
    const candidates = this.config.providers
      .filter((p) => this.isProviderAvailable(p.provider))
      .map((p) => {
        const model = this.modelSelector.selectBest(p, context);
        const latency = this.latencyOptimizer.estimateLatency(p.provider, model);
        return { provider: p, model, latency };
      })
      .sort((a, b) => a.latency - b.latency);

    const best = candidates[0];
    if (!best) {
      return this.routeDefault(context);
    }

    return {
      provider: best.provider.provider,
      model: best.model,
      reason: `Least latency (${best.latency}ms estimated)`,
      estimatedCost: this.costOptimizer.estimateCost(best.provider.provider, best.model, context.promptTokens, context.maxTokens),
      estimatedLatency: best.latency,
      alternatives: [],
    };
  }

  private routeCostOptimized(context: RoutingContext): RoutingDecision {
    const candidates = this.config.providers
      .filter((p) => this.isProviderAvailable(p.provider))
      .map((p) => {
        const model = this.modelSelector.selectBest(p, context);
        const cost = this.costOptimizer.estimateCost(p.provider, model, context.promptTokens, context.maxTokens);
        return { provider: p, model, cost };
      })
      .sort((a, b) => a.cost - b.cost);

    const best = candidates[0];
    if (!best) {
      return this.routeDefault(context);
    }

    return {
      provider: best.provider.provider,
      model: best.model,
      reason: `Cost optimized ($${best.cost.toFixed(6)} estimated)`,
      estimatedCost: best.cost,
      estimatedLatency: this.latencyOptimizer.estimateLatency(best.provider.provider, best.model),
      alternatives: [],
    };
  }

  private routeQualityOptimized(context: RoutingContext): RoutingDecision {
    const qualityRanking: Record<string, number> = {
      'claude-3-opus-20240229': 10,
      'gpt-4o': 9,
      'claude-3-5-sonnet-20241022': 8,
      'gemini-1.5-pro': 7,
      'gpt-4-turbo': 6,
      'mistral-large-latest': 5,
      'gpt-4o-mini': 4,
      'claude-3-haiku-20240307': 3,
      'gemini-1.5-flash': 2,
      'gpt-3.5-turbo': 1,
    };

    const candidates = this.config.providers
      .filter((p) => this.isProviderAvailable(p.provider))
      .flatMap((p) =>
        p.models.map((m) => ({
          provider: p,
          model: m,
          quality: qualityRanking[m] ?? 0,
        })),
      )
      .filter((c) => c.quality > 0)
      .sort((a, b) => b.quality - a.quality);

    const best = candidates[0];
    if (!best) {
      return this.routeDefault(context);
    }

    return {
      provider: best.provider.provider,
      model: best.model,
      reason: `Quality optimized (score: ${best.quality})`,
      estimatedCost: this.costOptimizer.estimateCost(best.provider.provider, best.model, context.promptTokens, context.maxTokens),
      estimatedLatency: this.latencyOptimizer.estimateLatency(best.provider.provider, best.model),
      alternatives: [],
    };
  }

  private routeAdaptive(context: RoutingContext): RoutingDecision {
    const scores: Array<{
      provider: ProviderConfig;
      model: string;
      score: number;
      cost: number;
      latency: number;
    }> = [];

    for (const provider of this.config.providers) {
      if (!this.isProviderAvailable(provider.provider)) continue;

      const model = this.modelSelector.selectBest(provider, context);
      const cost = this.costOptimizer.estimateCost(provider.provider, model, context.promptTokens, context.maxTokens);
      const latency = this.latencyOptimizer.estimateLatency(provider.provider, model);
      const health = this.providerHealth.get(provider.provider);

      let score = 50;

      if (cost < 0.001) score += 20;
      else if (cost < 0.01) score += 10;
      else if (cost > 0.05) score -= 10;

      if (latency < 1000) score += 15;
      else if (latency < 3000) score += 5;
      else if (latency > 10000) score -= 15;

      if (health) {
        if (health.errorRate < 0.01) score += 10;
        else if (health.errorRate > 0.1) score -= 20;
      }

      if (context.priority === 'high' && latency < 2000) score += 10;
      if (context.priority === 'low' && cost < 0.001) score += 10;

      if (context.budgetRemaining < 1 && cost < 0.001) score += 15;

      scores.push({ provider, model, score, cost, latency });
    }

    scores.sort((a, b) => b.score - a.score);

    const best = scores[0];
    if (!best) {
      return this.routeDefault(context);
    }

    return {
      provider: best.provider.provider,
      model: best.model,
      reason: `Adaptive routing (score: ${best.score.toFixed(1)})`,
      estimatedCost: best.cost,
      estimatedLatency: best.latency,
      alternatives: [],
    };
  }

  private routeManual(context: RoutingContext): RoutingDecision {
    const rule = this.routingRules.match(context);
    if (rule) {
      return this.applyRuleDecision(rule, context);
    }
    return this.routeDefault(context);
  }

  private routeDefault(context: RoutingContext): RoutingDecision {
    const provider = this.config.providers.find(
      (p) => p.provider === this.config.defaultProvider,
    );
    if (!provider) {
      const first = this.config.providers[0];
      if (!first) {
        throw new Error('No providers configured');
      }
      return {
        provider: first.provider,
        model: first.defaultModel,
        reason: 'No default provider found, using first available',
        estimatedCost: 0,
        estimatedLatency: 0,
        alternatives: [],
      };
    }

    return {
      provider: provider.provider,
      model: this.config.defaultModel,
      reason: 'Default provider and model',
      estimatedCost: this.costOptimizer.estimateCost(provider.provider, this.config.defaultModel, context.promptTokens, context.maxTokens),
      estimatedLatency: this.latencyOptimizer.estimateLatency(provider.provider, this.config.defaultModel),
      alternatives: [],
    };
  }

  private applyRuleDecision(rule: RoutingRule, context: RoutingContext): RoutingDecision {
    return {
      provider: rule.provider,
      model: rule.model,
      reason: `Rule: ${rule.name}`,
      estimatedCost: this.costOptimizer.estimateCost(rule.provider, rule.model, context.promptTokens, context.maxTokens),
      estimatedLatency: this.latencyOptimizer.estimateLatency(rule.provider, rule.model),
      alternatives: [],
    };
  }

  private isProviderAvailable(provider: string): boolean {
    const health = this.providerHealth.get(provider);
    return health ? health.available : true;
  }

  private findAlternative(original: RoutingDecision, context: RoutingContext): RoutingDecision {
    const available = this.config.providers.filter(
      (p) => this.isProviderAvailable(p.provider) && p.provider !== original.provider,
    );

    if (available.length === 0) {
      logger.warn('No alternative providers available, using original');
      return original;
    }

    const provider = available[0];
    const model = this.modelSelector.selectBest(provider, context);

    return {
      provider: provider.provider,
      model,
      reason: `Fallback from unavailable ${original.provider}`,
      estimatedCost: this.costOptimizer.estimateCost(provider.provider, model, context.promptTokens, context.maxTokens),
      estimatedLatency: this.latencyOptimizer.estimateLatency(provider.provider, model),
      alternatives: [],
    };
  }

  private generateAlternatives(
    decision: RoutingDecision,
    context: RoutingContext,
  ): Array<{ provider: string; model: string; reason: string }> {
    return this.config.providers
      .filter(
        (p) =>
          p.provider !== decision.provider &&
          this.isProviderAvailable(p.provider),
      )
      .slice(0, 3)
      .map((p) => ({
        provider: p.provider,
        model: this.modelSelector.selectBest(p, context),
        reason: 'Alternative provider',
      }));
  }
}
