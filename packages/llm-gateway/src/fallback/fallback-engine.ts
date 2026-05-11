import { createLogger, generateId } from '@paracosm/shared';
import type { LLMProvider, LLMRequest, LLMResponse } from '@paracosm/shared';
import type { CircuitBreaker } from './circuit-breaker.js';
import type { HealthChecker, ProviderHealthStatus } from './health-checker.js';

const logger = createLogger('FallbackEngine');

export interface FallbackConfig {
  enabled: boolean;
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  fallbackProviders: LLMProvider[];
  fallbackModels: string[];
  autoHealEnabled: boolean;
  autoHealIntervalMs: number;
  degradationThreshold: number;
}

export interface FallbackDecision {
  id: string;
  originalProvider: string;
  originalModel: string;
  fallbackProvider: string;
  fallbackModel: string;
  reason: string;
  attempt: number;
  timestamp: number;
}

export interface FallbackResult {
  success: boolean;
  response?: LLMResponse;
  decisions: FallbackDecision[];
  totalAttempts: number;
  totalDelayMs: number;
  finalProvider: string;
  finalModel: string;
}

export interface ProviderExecution {
  provider: LLMProvider;
  model: string;
  priority: number;
  healthScore: number;
  estimatedLatency: number;
}

export class FallbackEngine {
  private config: FallbackConfig;
  private circuitBreaker: CircuitBreaker | null = null;
  private healthChecker: HealthChecker | null = null;
  private fallbackHistory: Array<{
    requestId: string;
    result: FallbackResult;
    timestamp: number;
  }> = [];
  private maxHistorySize: number = 500;
  private providerExecutors: Map<string, (request: LLMRequest) => Promise<LLMResponse>> = new Map();
  private autoHealTimer: ReturnType<typeof setInterval> | null = null;
  private degradedProviders: Set<string> = new Set();

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      fallbackProviders: config.fallbackProviders ?? [],
      fallbackModels: config.fallbackModels ?? [],
      autoHealEnabled: config.autoHealEnabled ?? true,
      autoHealIntervalMs: config.autoHealIntervalMs ?? 30000,
      degradationThreshold: config.degradationThreshold ?? 0.5,
    };

    if (this.config.autoHealEnabled) {
      this.startAutoHeal();
    }
  }

  setCircuitBreaker(cb: CircuitBreaker): void {
    this.circuitBreaker = cb;
  }

  setHealthChecker(hc: HealthChecker): void {
    this.healthChecker = hc;
  }

  registerProviderExecutor(provider: string, executor: (request: LLMRequest) => Promise<LLMResponse>): void {
    this.providerExecutors.set(provider, executor);
  }

  async check(request: LLMRequest): Promise<{
    needsFallback: boolean;
    reason?: string;
    suggestedProvider?: string;
    suggestedModel?: string;
  }> {
    if (!this.config.enabled) {
      return { needsFallback: false };
    }

    const provider = request.provider;

    if (this.circuitBreaker) {
      const state = this.circuitBreaker.getState(provider);
      if (state === 'open') {
        const suggestion = this.findBestAlternative(provider, request.model);
        return {
          needsFallback: true,
          reason: `Circuit breaker open for ${provider}`,
          suggestedProvider: suggestion.provider,
          suggestedModel: suggestion.model,
        };
      }
    }

    if (this.healthChecker) {
      const health = this.healthChecker.getHealth(provider);
      if (health && !health.isAvailable) {
        const suggestion = this.findBestAlternative(provider, request.model);
        return {
          needsFallback: true,
          reason: `Provider ${provider} is unhealthy: ${health.status}`,
          suggestedProvider: suggestion.provider,
          suggestedModel: suggestion.model,
        };
      }

      if (health && health.healthScore < this.config.degradationThreshold) {
        const suggestion = this.findBestAlternative(provider, request.model);
        return {
          needsFallback: true,
          reason: `Provider ${provider} is degraded (score: ${health.healthScore.toFixed(2)})`,
          suggestedProvider: suggestion.provider,
          suggestedModel: suggestion.model,
        };
      }
    }

    if (this.degradedProviders.has(provider)) {
      const suggestion = this.findBestAlternative(provider, request.model);
      return {
        needsFallback: true,
        reason: `Provider ${provider} is marked as degraded`,
        suggestedProvider: suggestion.provider,
        suggestedModel: suggestion.model,
      };
    }

    return { needsFallback: false };
  }

  async switch(request: LLMRequest, error?: Error): Promise<FallbackResult> {
    const decisions: FallbackDecision[] = [];
    let totalDelayMs = 0;
    let currentRequest = { ...request };
    let lastError: Error | undefined = error;

    const alternatives = this.getOrderedAlternatives(request.provider, request.model);

    for (let attempt = 0; attempt < this.config.maxRetries && attempt < alternatives.length; attempt++) {
      const alternative = alternatives[attempt];
      const delayMs = this.calculateDelay(attempt);

      if (delayMs > 0) {
        await this.sleep(delayMs);
        totalDelayMs += delayMs;
      }

      const decision: FallbackDecision = {
        id: generateId(),
        originalProvider: request.provider,
        originalModel: request.model,
        fallbackProvider: alternative.provider,
        fallbackModel: alternative.model,
        reason: lastError ? lastError.message : 'Proactive fallback',
        attempt: attempt + 1,
        timestamp: Date.now(),
      };
      decisions.push(decision);

      currentRequest = {
        ...currentRequest,
        provider: alternative.provider as LLMProvider,
        model: alternative.model,
      };

      const executor = this.providerExecutors.get(alternative.provider);
      if (!executor) {
        lastError = new Error(`No executor for provider ${alternative.provider}`);
        logger.warn('No executor for fallback provider', { provider: alternative.provider });
        continue;
      }

      try {
        const response = await executor(currentRequest);

        if (this.circuitBreaker) {
          this.circuitBreaker.recordSuccess(alternative.provider);
        }

        logger.info('Fallback succeeded', {
          originalProvider: request.provider,
          fallbackProvider: alternative.provider,
          fallbackModel: alternative.model,
          attempt: attempt + 1,
        });

        const result: FallbackResult = {
          success: true,
          response,
          decisions,
          totalAttempts: attempt + 1,
          totalDelayMs,
          finalProvider: alternative.provider,
          finalModel: alternative.model,
        };

        this.recordHistory(request.id, result);
        return result;
      } catch (err) {
        lastError = err as Error;

        if (this.circuitBreaker) {
          this.circuitBreaker.recordFailure(alternative.provider, err as Error);
        }

        logger.warn('Fallback attempt failed', {
          provider: alternative.provider,
          model: alternative.model,
          attempt: attempt + 1,
          error: (err as Error).message,
        });
      }
    }

    const result: FallbackResult = {
      success: false,
      decisions,
      totalAttempts: decisions.length,
      totalDelayMs,
      finalProvider: decisions.length > 0 ? decisions[decisions.length - 1].fallbackProvider : request.provider,
      finalModel: decisions.length > 0 ? decisions[decisions.length - 1].fallbackModel : request.model,
    };

    this.recordHistory(request.id, result);
    return result;
  }

  async recover(provider: string): Promise<boolean> {
    if (!this.degradedProviders.has(provider)) return true;

    const executor = this.providerExecutors.get(provider);
    if (!executor) return false;

    try {
      const testRequest: LLMRequest = {
        id: generateId(),
        model: 'test',
        provider: provider as LLMProvider,
        prompt: 'recovery test',
        maxTokens: 1,
        metadata: {},
        timestamp: new Date(),
      };

      await executor(testRequest);

      this.degradedProviders.delete(provider);
      logger.info('Provider recovered', { provider });
      return true;
    } catch (error) {
      logger.warn('Provider recovery failed', { provider, error: (error as Error).message });
      return false;
    }
  }

  async autoHeal(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const provider of this.degradedProviders) {
      const recovered = await this.recover(provider);
      results.set(provider, recovered);
    }

    if (this.healthChecker) {
      const allHealth = this.healthChecker.getAllHealth();
      for (const [provider, health] of allHealth) {
        if (!health.isAvailable) {
          const recovered = await this.recover(provider);
          results.set(provider, recovered);
        }
      }
    }

    return results;
  }

  markDegraded(provider: string): void {
    this.degradedProviders.add(provider);
    logger.warn('Provider marked as degraded', { provider });
  }

  markHealthy(provider: string): void {
    this.degradedProviders.delete(provider);
    logger.info('Provider marked as healthy', { provider });
  }

  getDegradedProviders(): string[] {
    return Array.from(this.degradedProviders);
  }

  getHistory(limit: number = 50): typeof this.fallbackHistory {
    return this.fallbackHistory.slice(-limit);
  }

  getConfig(): FallbackConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<FallbackConfig>): void {
    this.config = { ...this.config, ...updates };
    if (this.autoHealTimer && !this.config.autoHealEnabled) {
      this.stopAutoHeal();
    } else if (!this.autoHealTimer && this.config.autoHealEnabled) {
      this.startAutoHeal();
    }
  }

  destroy(): void {
    this.stopAutoHeal();
  }

  private findBestAlternative(provider: string, model: string): { provider: string; model: string } {
    const alternatives = this.getOrderedAlternatives(provider, model);
    if (alternatives.length > 0) {
      return { provider: alternatives[0].provider, model: alternatives[0].model };
    }
    return { provider, model };
  }

  private getOrderedAlternatives(excludeProvider: string, preferredModel: string): ProviderExecution[] {
    const candidates: ProviderExecution[] = [];

    for (const provider of this.config.fallbackProviders) {
      if (provider === excludeProvider) continue;

      let healthScore = 1.0;
      let estimatedLatency = 1000;

      if (this.healthChecker) {
        const health = this.healthChecker.getHealth(provider);
        if (health) {
          healthScore = health.healthScore;
          estimatedLatency = health.averageLatencyMs;
        }
      }

      if (this.circuitBreaker) {
        const state = this.circuitBreaker.getState(provider);
        if (state === 'open') continue;
        if (state === 'half-open') healthScore *= 0.5;
      }

      if (this.degradedProviders.has(provider)) continue;

      const models = this.config.fallbackModels.length > 0
        ? this.config.fallbackModels
        : [preferredModel];

      for (const model of models) {
        candidates.push({
          provider,
          model,
          priority: candidates.length,
          healthScore,
          estimatedLatency,
        });
      }
    }

    candidates.sort((a, b) => {
      const healthDiff = b.healthScore - a.healthScore;
      if (Math.abs(healthDiff) > 0.1) return healthDiff;
      return a.estimatedLatency - b.estimatedLatency;
    });

    return candidates;
  }

  private calculateDelay(attempt: number): number {
    return Math.min(
      this.config.retryDelayMs * Math.pow(this.config.backoffMultiplier, attempt),
      30000,
    );
  }

  private recordHistory(requestId: string, result: FallbackResult): void {
    this.fallbackHistory.push({ requestId, result, timestamp: Date.now() });
    if (this.fallbackHistory.length > this.maxHistorySize) {
      this.fallbackHistory = this.fallbackHistory.slice(-this.maxHistorySize);
    }
  }

  private startAutoHeal(): void {
    if (this.autoHealTimer) return;
    this.autoHealTimer = setInterval(async () => {
      try {
        await this.autoHeal();
      } catch (error) {
        logger.error('Auto-heal error', { error: (error as Error).message });
      }
    }, this.config.autoHealIntervalMs);
  }

  private stopAutoHeal(): void {
    if (this.autoHealTimer) {
      clearInterval(this.autoHealTimer);
      this.autoHealTimer = null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
