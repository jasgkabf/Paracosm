import type { ProviderStatus } from "@paracosm/shared";
import type { LLMRequestEvent, ProviderMetricsSnapshot } from "./types.js";

interface ProviderState {
  providerId: string;
  providerName: string;
  available: boolean;
  latencyMs: number;
  errorRate: number;
  quotaRemaining: number;
  quotaLimit: number;
  circuitState: "closed" | "open" | "half_open";
  activeRequests: number;
  totalRequests: number;
  totalErrors: number;
  lastRequestAt: string;
  recentLatencies: number[];
  recentErrors: number[];
  requestTimestamps: number[];
  errorTimestamps: number[];
  tokensIn: number;
  tokensOut: number;
  totalCost: number;
}

interface LLMState {
  activeRequests: number;
  queueDepth: number;
  recentResponseTimes: number[];
  errorTimestamps: number[];
  requestTimestamps: number[];
  tokenTimestamps: Array<{ timestamp: number; tokens: number }>;
  costTimestamps: Array<{ timestamp: number; cost: number }>;
  providers: Map<string, ProviderState>;
}

export class LLMMetrics {
  private state: LLMState;
  private maxLatencySamples: number;
  private metricsWindowMs: number;
  private circuitBreakerThreshold: number;
  private circuitBreakerCooldownMs: number;

  constructor() {
    this.state = {
      activeRequests: 0,
      queueDepth: 0,
      recentResponseTimes: [],
      errorTimestamps: [],
      requestTimestamps: [],
      tokenTimestamps: [],
      costTimestamps: [],
      providers: new Map(),
    };
    this.maxLatencySamples = 1000;
    this.metricsWindowMs = 60000;
    this.circuitBreakerThreshold = 5;
    this.circuitBreakerCooldownMs = 30000;
    this.initializeDefaultProviders();
  }

  private initializeDefaultProviders(): void {
    const defaultProviders = [
      { id: "openai", name: "OpenAI" },
      { id: "anthropic", name: "Anthropic" },
      { id: "google", name: "Google AI" },
      { id: "deepseek", name: "DeepSeek" },
    ];

    for (const provider of defaultProviders) {
      this.state.providers.set(provider.id, {
        providerId: provider.id,
        providerName: provider.name,
        available: true,
        latencyMs: 0,
        errorRate: 0,
        quotaRemaining: 1000000,
        quotaLimit: 1000000,
        circuitState: "closed",
        activeRequests: 0,
        totalRequests: 0,
        totalErrors: 0,
        lastRequestAt: new Date().toISOString(),
        recentLatencies: [],
        recentErrors: [],
        requestTimestamps: [],
        errorTimestamps: [],
        tokensIn: 0,
        tokensOut: 0,
        totalCost: 0,
      });
    }
  }

  updateRequest(event: LLMRequestEvent): void {
    const now = Date.now();

    switch (event.type) {
      case "request_start":
        this.state.activeRequests++;
        this.state.requestTimestamps.push(now);
        this.pruneTimestamps(this.state.requestTimestamps, this.metricsWindowMs);

        if (event.providerId) {
          const provider = this.state.providers.get(event.providerId);
          if (provider) {
            provider.activeRequests++;
            provider.totalRequests++;
            provider.lastRequestAt = event.timestamp;
            provider.requestTimestamps.push(now);
            this.pruneTimestamps(provider.requestTimestamps, this.metricsWindowMs);
          }
        }
        break;

      case "request_end":
        this.state.activeRequests = Math.max(0, this.state.activeRequests - 1);

        if (event.durationMs !== undefined) {
          this.state.recentResponseTimes.push(event.durationMs);
          if (this.state.recentResponseTimes.length > this.maxLatencySamples) {
            this.state.recentResponseTimes.shift();
          }
        }

        if (event.tokensIn !== undefined) {
          this.state.tokenTimestamps.push({ timestamp: now, tokens: event.tokensIn });
        }
        if (event.tokensOut !== undefined) {
          this.state.tokenTimestamps.push({ timestamp: now, tokens: event.tokensOut });
        }
        if (event.cost !== undefined) {
          this.state.costTimestamps.push({ timestamp: now, cost: event.cost });
        }

        if (event.providerId) {
          const provider = this.state.providers.get(event.providerId);
          if (provider) {
            provider.activeRequests = Math.max(0, provider.activeRequests - 1);
            if (event.durationMs !== undefined) {
              provider.latencyMs = event.durationMs;
              provider.recentLatencies.push(event.durationMs);
              if (provider.recentLatencies.length > this.maxLatencySamples) {
                provider.recentLatencies.shift();
              }
            }
            if (event.tokensIn !== undefined) provider.tokensIn += event.tokensIn;
            if (event.tokensOut !== undefined) provider.tokensOut += event.tokensOut;
            if (event.cost !== undefined) provider.totalCost += event.cost;
            if (provider.circuitState === "half_open") {
              provider.circuitState = "closed";
            }
          }
        }
        break;

      case "request_error":
        this.state.activeRequests = Math.max(0, this.state.activeRequests - 1);
        this.state.errorTimestamps.push(now);
        this.pruneTimestamps(this.state.errorTimestamps, this.metricsWindowMs);

        if (event.providerId) {
          const provider = this.state.providers.get(event.providerId);
          if (provider) {
            provider.activeRequests = Math.max(0, provider.activeRequests - 1);
            provider.totalErrors++;
            provider.errorTimestamps.push(now);
            this.pruneTimestamps(provider.errorTimestamps, this.metricsWindowMs);
            provider.recentErrors.push(now);
            if (provider.recentErrors.length > this.circuitBreakerThreshold * 2) {
              provider.recentErrors.shift();
            }
            this.updateCircuitBreaker(provider);
          }
        }
        break;

      case "queue_add":
        this.state.queueDepth++;
        break;

      case "queue_remove":
        this.state.queueDepth = Math.max(0, this.state.queueDepth - 1);
        break;
    }
  }

  private updateCircuitBreaker(provider: ProviderState): void {
    const now = Date.now();
    const recentErrors = provider.recentErrors.filter(
      (t) => now - t < this.metricsWindowMs
    );
    const recentRequests = provider.requestTimestamps.filter(
      (t) => now - t < this.metricsWindowMs
    );

    if (recentRequests.length === 0) return;

    const errorRate = recentErrors.length / recentRequests.length;

    if (provider.circuitState === "closed" && errorRate > 0.5) {
      provider.circuitState = "open";
      provider.available = false;
    } else if (provider.circuitState === "open") {
      const lastError = provider.recentErrors[provider.recentErrors.length - 1];
      if (lastError !== undefined && now - lastError > this.circuitBreakerCooldownMs) {
        provider.circuitState = "half_open";
        provider.available = true;
      }
    }
  }

  private pruneTimestamps(timestamps: number[], windowMs: number): void {
    const cutoff = Date.now() - windowMs;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }
  }

  activeRequests(): number {
    return this.state.activeRequests;
  }

  queueDepth(): number {
    return this.state.queueDepth;
  }

  avgResponseTime(): number {
    if (this.state.recentResponseTimes.length === 0) return 0;
    const sum = this.state.recentResponseTimes.reduce((a, b) => a + b, 0);
    return sum / this.state.recentResponseTimes.length;
  }

  p95ResponseTime(): number {
    if (this.state.recentResponseTimes.length === 0) return 0;
    const sorted = [...this.state.recentResponseTimes].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, index)];
  }

  errorRate(): number {
    this.pruneTimestamps(this.state.requestTimestamps, this.metricsWindowMs);
    this.pruneTimestamps(this.state.errorTimestamps, this.metricsWindowMs);
    if (this.state.requestTimestamps.length === 0) return 0;
    return Math.min(1, this.state.errorTimestamps.length / this.state.requestTimestamps.length);
  }

  tokenThroughput(): number {
    const now = Date.now();
    const windowStart = now - this.metricsWindowMs;
    const recentTokens = this.state.tokenTimestamps.filter(
      (t) => t.timestamp >= windowStart
    );
    if (recentTokens.length === 0) return 0;
    const totalTokens = recentTokens.reduce((sum, t) => sum + t.tokens, 0);
    const windowSeconds = this.metricsWindowMs / 1000;
    return totalTokens / windowSeconds;
  }

  costRate(): number {
    const now = Date.now();
    const windowStart = now - this.metricsWindowMs;
    const recentCosts = this.state.costTimestamps.filter(
      (t) => t.timestamp >= windowStart
    );
    if (recentCosts.length === 0) return 0;
    const totalCost = recentCosts.reduce((sum, t) => sum + t.cost, 0);
    const windowMinutes = this.metricsWindowMs / 60000;
    return totalCost / windowMinutes;
  }

  providerHealth(): Record<string, ProviderStatus> {
    const result: Record<string, ProviderStatus> = {};
    for (const [id, provider] of this.state.providers) {
      result[id] = {
        providerId: provider.providerId,
        providerName: provider.providerName,
        available: provider.available,
        latencyMs: this.calculateProviderAvgLatency(provider),
        errorRate: this.calculateProviderErrorRate(provider),
        quotaRemaining: provider.quotaRemaining,
        quotaLimit: provider.quotaLimit,
        lastRequestAt: provider.lastRequestAt,
        circuitState: provider.circuitState,
      };
    }
    return result;
  }

  private calculateProviderAvgLatency(provider: ProviderState): number {
    if (provider.recentLatencies.length === 0) return provider.latencyMs;
    const sum = provider.recentLatencies.reduce((a, b) => a + b, 0);
    return sum / provider.recentLatencies.length;
  }

  private calculateProviderErrorRate(provider: ProviderState): number {
    this.pruneTimestamps(provider.requestTimestamps, this.metricsWindowMs);
    this.pruneTimestamps(provider.errorTimestamps, this.metricsWindowMs);
    if (provider.requestTimestamps.length === 0) return 0;
    return Math.min(1, provider.errorTimestamps.length / provider.requestTimestamps.length);
  }

  providerSnapshot(providerId: string): ProviderMetricsSnapshot | null {
    const provider = this.state.providers.get(providerId);
    if (!provider) return null;
    return {
      providerId: provider.providerId,
      providerName: provider.providerName,
      available: provider.available,
      latencyMs: this.calculateProviderAvgLatency(provider),
      errorRate: this.calculateProviderErrorRate(provider),
      quotaRemaining: provider.quotaRemaining,
      quotaLimit: provider.quotaLimit,
      circuitState: provider.circuitState,
      activeRequests: provider.activeRequests,
      totalRequests: provider.totalRequests,
      totalErrors: provider.totalErrors,
      lastRequestAt: provider.lastRequestAt,
    };
  }

  availableProviderCount(): number {
    let count = 0;
    for (const provider of this.state.providers.values()) {
      if (provider.available && provider.circuitState !== "open") count++;
    }
    return count;
  }

  totalProviderCount(): number {
    return this.state.providers.size;
  }

  hasAvailableProviders(): boolean {
    return this.availableProviderCount() > 0;
  }

  totalTokensProcessed(): { in: number; out: number } {
    let tokensIn = 0;
    let tokensOut = 0;
    for (const provider of this.state.providers.values()) {
      tokensIn += provider.tokensIn;
      tokensOut += provider.tokensOut;
    }
    return { in: tokensIn, out: tokensOut };
  }

  totalCost(): number {
    let cost = 0;
    for (const provider of this.state.providers.values()) {
      cost += provider.totalCost;
    }
    return cost;
  }

  reset(): void {
    this.state = {
      activeRequests: 0,
      queueDepth: 0,
      recentResponseTimes: [],
      errorTimestamps: [],
      requestTimestamps: [],
      tokenTimestamps: [],
      costTimestamps: [],
      providers: new Map(),
    };
    this.initializeDefaultProviders();
  }

  snapshot(): Record<string, unknown> {
    return {
      activeRequests: this.activeRequests(),
      queueDepth: this.queueDepth(),
      avgResponseTime: this.avgResponseTime(),
      p95ResponseTime: this.p95ResponseTime(),
      errorRate: this.errorRate(),
      tokenThroughput: this.tokenThroughput(),
      costRate: this.costRate(),
      availableProviders: this.availableProviderCount(),
      totalProviders: this.totalProviderCount(),
      totalTokens: this.totalTokensProcessed(),
      totalCost: this.totalCost(),
    };
  }
}
