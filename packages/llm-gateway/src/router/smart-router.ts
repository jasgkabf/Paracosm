import { EventEmitter } from "node:events";
import type { LLMRequest, LLMModel, LLMModelId, ProviderConfig, RoutingRule, RoutingConfig } from "@paracosm/shared";
import { Result, ok, err } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";
import { TaskClassifier } from "./task-classifier.js";
import { CostOptimizer } from "./cost-optimizer.js";
import { LoadBalancer } from "./load-balancer.js";
import { LatencyOptimizer } from "./latency-optimizer.js";
import { RoutingRules } from "./routing-rules.js";
import { RoutingAnalytics } from "./routing-analytics.js";
import { ModelSelector } from "./model-selector.js";
import { ContextFitter } from "./context-fitter.js";
import { TokenEstimator } from "./token-estimator.js";

const logger = new Logger("SmartRouter");

export interface RoutingContext {
  request: LLMRequest;
  models: LLMModel[];
  providers: ProviderConfig[];
  routingConfig: RoutingConfig;
  taskType?: string;
  budgetRemaining?: number;
  latencyRequirement?: number;
  qualityRequirement?: number;
}

export interface RoutingDecision {
  modelId: string;
  providerId: string;
  reason: string;
  estimatedCost: number;
  estimatedLatencyMs: number;
  confidence: number;
  alternatives: { modelId: string; reason: string }[];
}

export class SmartRouter extends EventEmitter {
  private taskClassifier: TaskClassifier;
  private costOptimizer: CostOptimizer;
  private loadBalancer: LoadBalancer;
  private latencyOptimizer: LatencyOptimizer;
  private routingRules: RoutingRules;
  private analytics: RoutingAnalytics;
  private modelSelector: ModelSelector;
  private contextFitter: ContextFitter;
  private tokenEstimator: TokenEstimator;
  private models: Map<string, LLMModel> = new Map();
  private providers: Map<string, ProviderConfig> = new Map();
  private routingConfig: RoutingConfig | null = null;

  constructor() {
    super();
    this.taskClassifier = new TaskClassifier();
    this.costOptimizer = new CostOptimizer();
    this.loadBalancer = new LoadBalancer();
    this.latencyOptimizer = new LatencyOptimizer();
    this.routingRules = new RoutingRules();
    this.analytics = new RoutingAnalytics();
    this.modelSelector = new ModelSelector();
    this.contextFitter = new ContextFitter();
    this.tokenEstimator = new TokenEstimator();
  }

  configure(models: LLMModel[], providers: ProviderConfig[], routingConfig: RoutingConfig): void {
    this.models.clear();
    this.providers.clear();
    for (const model of models) {
      this.models.set(model.modelId, model);
    }
    for (const provider of providers) {
      this.providers.set(provider.providerId, provider);
    }
    this.routingConfig = routingConfig;
    this.routingRules.loadRules(routingConfig.rules);
    logger.info("SmartRouter configured", { modelCount: models.length, providerCount: providers.length });
  }

  route(context: RoutingContext): Result<RoutingDecision, Error> {
    const startTime = Date.now();

    const availableModels = this.filterAvailableModels(context);
    if (availableModels.length === 0) {
      return err(new Error("No available models for routing"));
    }

    const ruleResult = this.routingRules.evaluate(context.request, availableModels);
    if (ruleResult.ok) {
      const decision = ruleResult.value;
      this.analytics.trackRouting(decision.modelId as LLMModelId, "rule", Date.now() - startTime);
      this.emit("routed", decision);
      return ok(decision);
    }

    const taskType = context.taskType ?? this.taskClassifier.classify(context.request);
    const strategy = context.routingConfig.strategy;

    let decision: RoutingDecision;

    switch (strategy) {
      case "cost_optimized":
        decision = this.optimizeCost(context, availableModels, taskType);
        break;
      case "performance_optimized":
        decision = this.optimizeSpeed(context, availableModels, taskType);
        break;
      case "balanced":
        decision = this.optimizeQuality(context, availableModels, taskType);
        break;
      case "round_robin":
      case "weighted":
        decision = this.loadBalancedRoute(context, availableModels);
        break;
      case "adaptive":
        decision = this.adaptiveRoute(context, availableModels, taskType);
        break;
      case "context_aware":
        decision = this.contextAwareRoute(context, availableModels);
        break;
      default:
        decision = this.optimizeQuality(context, availableModels, taskType);
    }

    this.analytics.trackRouting(decision.modelId as LLMModelId, strategy, Date.now() - startTime);
    this.emit("routed", decision);
    return ok(decision);
  }

  selectModel(request: LLMRequest, models: LLMModel[]): Result<LLMModel, Error> {
    const candidates = models.filter((m) => m.availability > 0);
    if (candidates.length === 0) {
      return err(new Error("No available models"));
    }
    const taskType = this.taskClassifier.classify(request);
    const ranked = this.modelSelector.rank(candidates, taskType);
    if (ranked.length === 0) {
      return err(new Error("No suitable model found"));
    }
    return ok(ranked[0]);
  }

  optimizeCost(context: RoutingContext, models: LLMModel[], taskType: string): RoutingDecision {
    const estimatedTokens = this.tokenEstimator.estimate(context.request);
    const cheapest = this.costOptimizer.findCheapest(models, estimatedTokens);
    if (!cheapest) {
      return this.fallbackDecision(models);
    }
    const provider = this.getProviderForModel(cheapest);
    return {
      modelId: cheapest.modelId,
      providerId: provider?.providerId ?? "unknown",
      reason: `Cost optimized for task type: ${taskType}`,
      estimatedCost: this.costOptimizer.estimateCost(cheapest, estimatedTokens),
      estimatedLatencyMs: cheapest.latencyMs,
      confidence: 0.8,
      alternatives: models
        .filter((m) => m.modelId !== cheapest.modelId)
        .slice(0, 3)
        .map((m) => ({ modelId: m.modelId, reason: "Alternative cost option" })),
    };
  }

  optimizeSpeed(context: RoutingContext, models: LLMModel[], taskType: string): RoutingDecision {
    const fastest = this.latencyOptimizer.selectFastest(models);
    if (!fastest) {
      return this.fallbackDecision(models);
    }
    const provider = this.getProviderForModel(fastest);
    const estimatedTokens = this.tokenEstimator.estimate(context.request);
    return {
      modelId: fastest.modelId,
      providerId: provider?.providerId ?? "unknown",
      reason: `Speed optimized for task type: ${taskType}`,
      estimatedCost: this.costOptimizer.estimateCost(fastest, estimatedTokens),
      estimatedLatencyMs: this.latencyOptimizer.predictLatency(fastest),
      confidence: 0.75,
      alternatives: models
        .filter((m) => m.modelId !== fastest.modelId)
        .slice(0, 3)
        .map((m) => ({ modelId: m.modelId, reason: "Alternative speed option" })),
    };
  }

  optimizeQuality(context: RoutingContext, models: LLMModel[], taskType: string): RoutingDecision {
    const ranked = this.modelSelector.rank(models, taskType);
    const best = ranked[0];
    if (!best) {
      return this.fallbackDecision(models);
    }
    const provider = this.getProviderForModel(best);
    const estimatedTokens = this.tokenEstimator.estimate(context.request);
    return {
      modelId: best.modelId,
      providerId: provider?.providerId ?? "unknown",
      reason: `Quality balanced for task type: ${taskType}`,
      estimatedCost: this.costOptimizer.estimateCost(best, estimatedTokens),
      estimatedLatencyMs: best.latencyMs,
      confidence: 0.85,
      alternatives: ranked.slice(1, 4).map((m) => ({ modelId: m.modelId, reason: "Alternative quality option" })),
    };
  }

  adaptiveRoute(context: RoutingContext, models: LLMModel[], taskType: string): RoutingDecision {
    const recentStats = this.analytics.getRecentStats();
    const costWeight = 0.33;
    const speedWeight = 0.33;
    const qualityWeight = 0.34;

    if (recentStats) {
      const costPressure = recentStats.averageCost > (context.budgetRemaining ?? Infinity) ? 0.5 : 0;
      const latencyPressure = recentStats.averageLatencyMs > (context.latencyRequirement ?? Infinity) ? 0.5 : 0;
      const adjustedCostWeight = costWeight + costPressure;
      const adjustedSpeedWeight = speedWeight + latencyPressure;
      const total = adjustedCostWeight + adjustedSpeedWeight + qualityWeight;
    }

    const estimatedTokens = this.tokenEstimator.estimate(context.request);
    const scored = models.map((model) => {
      const cost = this.costOptimizer.estimateCost(model, estimatedTokens);
      const latency = this.latencyOptimizer.predictLatency(model);
      const qualityScore = this.modelSelector.scoreForTask(model, taskType);
      const normalizedCost = 1 - Math.min(cost / 1, 1);
      const normalizedLatency = 1 - Math.min(latency / 60000, 1);
      const score = normalizedCost * costWeight + normalizedLatency * speedWeight + qualityScore * qualityWeight;
      return { model, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best) {
      return this.fallbackDecision(models);
    }
    const provider = this.getProviderForModel(best.model);
    return {
      modelId: best.model.modelId,
      providerId: provider?.providerId ?? "unknown",
      reason: `Adaptive routing for task type: ${taskType}, score: ${best.score.toFixed(3)}`,
      estimatedCost: this.costOptimizer.estimateCost(best.model, estimatedTokens),
      estimatedLatencyMs: this.latencyOptimizer.predictLatency(best.model),
      confidence: Math.min(best.score, 1),
      alternatives: scored.slice(1, 4).map((s) => ({ modelId: s.model.modelId, reason: `Score: ${s.score.toFixed(3)}` })),
    };
  }

  private loadBalancedRoute(context: RoutingContext, models: LLMModel[]): RoutingDecision {
    const selected = this.loadBalancer.select(models);
    if (!selected) {
      return this.fallbackDecision(models);
    }
    const provider = this.getProviderForModel(selected);
    const estimatedTokens = this.tokenEstimator.estimate(context.request);
    return {
      modelId: selected.modelId,
      providerId: provider?.providerId ?? "unknown",
      reason: "Load balanced selection",
      estimatedCost: this.costOptimizer.estimateCost(selected, estimatedTokens),
      estimatedLatencyMs: selected.latencyMs,
      confidence: 0.6,
      alternatives: [],
    };
  }

  private contextAwareRoute(context: RoutingContext, models: LLMModel[]): RoutingDecision {
    const fittedModels = this.contextFitter.fitToWindow(models, context.request.messages);
    if (fittedModels.length === 0) {
      return this.fallbackDecision(models);
    }
    const taskType = this.taskClassifier.classify(context.request);
    const ranked = this.modelSelector.rank(fittedModels, taskType);
    const best = ranked[0];
    if (!best) {
      return this.fallbackDecision(models);
    }
    const provider = this.getProviderForModel(best);
    const estimatedTokens = this.tokenEstimator.estimate(context.request);
    return {
      modelId: best.modelId,
      providerId: provider?.providerId ?? "unknown",
      reason: "Context-aware routing",
      estimatedCost: this.costOptimizer.estimateCost(best, estimatedTokens),
      estimatedLatencyMs: best.latencyMs,
      confidence: 0.8,
      alternatives: ranked.slice(1, 4).map((m) => ({ modelId: m.modelId, reason: "Context-fitted alternative" })),
    };
  }

  private filterAvailableModels(context: RoutingContext): LLMModel[] {
    return context.models.filter((m) => {
      if (m.availability <= 0) return false;
      const provider = this.getProviderForModel(m);
      if (provider && !provider.enabled) return false;
      return true;
    });
  }

  private getProviderForModel(model: LLMModel): ProviderConfig | undefined {
    return this.providers.get(model.providerId as string);
  }

  private fallbackDecision(models: LLMModel[]): RoutingDecision {
    const fallback = models[0];
    return {
      modelId: fallback.modelId,
      providerId: fallback.providerId as string,
      reason: "Fallback: first available model",
      estimatedCost: 0,
      estimatedLatencyMs: fallback.latencyMs,
      confidence: 0.3,
      alternatives: [],
    };
  }

  getAnalytics(): RoutingAnalytics {
    return this.analytics;
  }

  getTaskClassifier(): TaskClassifier {
    return this.taskClassifier;
  }

  getCostOptimizer(): CostOptimizer {
    return this.costOptimizer;
  }

  getLatencyOptimizer(): LatencyOptimizer {
    return this.latencyOptimizer;
  }
}
