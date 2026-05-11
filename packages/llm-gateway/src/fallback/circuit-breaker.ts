import { createLogger } from '@paracosm/shared';

const logger = createLogger('CircuitBreaker');

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
  adaptiveEnabled: boolean;
  adaptiveWindowMs: number;
  adaptiveMinRequests: number;
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  lastStateChangeTime: number;
  nextAttemptTime: number;
  failureRate: number;
  successRate: number;
}

export interface CircuitBreakerEvent {
  provider: string;
  previousState: CircuitBreakerState;
  newState: CircuitBreakerState;
  reason: string;
  timestamp: number;
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private circuits: Map<string, CircuitBreakerMetrics> = new Map();
  private events: CircuitBreakerEvent[] = [];
  private maxEvents: number = 500;
  private stateChangeCallbacks: Array<(event: CircuitBreakerEvent) => void> = [];
  private adaptiveThresholds: Map<string, {
    failureThreshold: number;
    resetTimeoutMs: number;
    recentRequests: number;
    recentFailures: number;
  }> = new Map();

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold ?? 5,
      successThreshold: config?.successThreshold ?? 3,
      resetTimeoutMs: config?.resetTimeoutMs ?? 60000,
      halfOpenMaxAttempts: config?.halfOpenMaxAttempts ?? 1,
      adaptiveEnabled: config?.adaptiveEnabled ?? true,
      adaptiveWindowMs: config?.adaptiveWindowMs ?? 300000,
      adaptiveMinRequests: config?.adaptiveMinRequests ?? 10,
    };
  }

  recordSuccess(provider: string): void {
    const metrics = this.getOrCreateMetrics(provider);
    metrics.totalRequests++;
    metrics.totalSuccesses++;
    metrics.consecutiveSuccesses++;
    metrics.consecutiveFailures = 0;
    metrics.lastSuccessTime = Date.now();

    if (this.config.adaptiveEnabled) {
      this.updateAdaptiveMetrics(provider, false);
    }

    if (metrics.state === 'half-open') {
      metrics.successCount++;
      if (metrics.successCount >= this.config.successThreshold) {
        this.transitionState(provider, 'closed', 'Enough successes in half-open state');
        metrics.failureCount = 0;
        metrics.successCount = 0;
        metrics.consecutiveFailures = 0;
      }
    }

    this.updateRates(metrics);
  }

  recordFailure(provider: string, error?: Error): void {
    const metrics = this.getOrCreateMetrics(provider);
    metrics.totalRequests++;
    metrics.totalFailures++;
    metrics.consecutiveFailures++;
    metrics.consecutiveSuccesses = 0;
    metrics.failureCount++;
    metrics.lastFailureTime = Date.now();

    if (this.config.adaptiveEnabled) {
      this.updateAdaptiveMetrics(provider, true);
    }

    if (metrics.state === 'half-open') {
      this.transitionState(provider, 'open', 'Failure during half-open state');
      metrics.nextAttemptTime = Date.now() + this.getResetTimeout(provider);
    } else if (metrics.state === 'closed') {
      const threshold = this.getFailureThreshold(provider);
      if (metrics.consecutiveFailures >= threshold || metrics.failureCount >= threshold) {
        this.transitionState(provider, 'open', `Failure threshold reached (${metrics.failureCount}/${threshold})`);
        metrics.nextAttemptTime = Date.now() + this.getResetTimeout(provider);
      }
    }

    this.updateRates(metrics);

    logger.warn('Circuit breaker recorded failure', {
      provider,
      state: metrics.state,
      failureCount: metrics.failureCount,
      consecutiveFailures: metrics.consecutiveFailures,
      error: error?.message,
    });
  }

  evaluate(provider: string): CircuitBreakerState {
    const metrics = this.getOrCreateMetrics(provider);

    if (metrics.state === 'open') {
      const resetTimeout = this.getResetTimeout(provider);
      if (Date.now() >= metrics.nextAttemptTime) {
        this.transitionState(provider, 'half-open', `Reset timeout elapsed (${resetTimeout}ms)`);
        metrics.successCount = 0;
      }
    }

    if (this.config.adaptiveEnabled) {
      this.adaptThresholds(provider);
    }

    return metrics.state;
  }

  getState(provider: string): CircuitBreakerState {
    const metrics = this.circuits.get(provider);
    if (!metrics) return 'closed';
    this.evaluate(provider);
    return this.circuits.get(provider)!.state;
  }

  open(provider: string): void {
    const metrics = this.getOrCreateMetrics(provider);
    if (metrics.state !== 'open') {
      this.transitionState(provider, 'open', 'Manually opened');
      metrics.nextAttemptTime = Date.now() + this.getResetTimeout(provider);
    }
  }

  halfOpen(provider: string): void {
    const metrics = this.getOrCreateMetrics(provider);
    if (metrics.state === 'open') {
      this.transitionState(provider, 'half-open', 'Manually set to half-open');
      metrics.successCount = 0;
    }
  }

  close(provider: string): void {
    const metrics = this.getOrCreateMetrics(provider);
    if (metrics.state !== 'closed') {
      this.transitionState(provider, 'closed', 'Manually closed');
      metrics.failureCount = 0;
      metrics.consecutiveFailures = 0;
    }
  }

  adaptive(provider: string): {
    adjustedFailureThreshold: number;
    adjustedResetTimeoutMs: number;
    recentFailureRate: number;
  } {
    const adaptive = this.adaptiveThresholds.get(provider);
    const metrics = this.circuits.get(provider);

    return {
      adjustedFailureThreshold: adaptive?.failureThreshold ?? this.config.failureThreshold,
      adjustedResetTimeoutMs: adaptive?.resetTimeoutMs ?? this.config.resetTimeoutMs,
      recentFailureRate: metrics?.failureRate ?? 0,
    };
  }

  getMetrics(provider: string): CircuitBreakerMetrics | undefined {
    const metrics = this.circuits.get(provider);
    return metrics ? { ...metrics } : undefined;
  }

  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const result: Record<string, CircuitBreakerMetrics> = {};
    for (const [key, value] of this.circuits) {
      result[key] = { ...value };
    }
    return result;
  }

  getEvents(filter?: {
    provider?: string;
    newState?: CircuitBreakerState;
    limit?: number;
  }): CircuitBreakerEvent[] {
    let result = [...this.events];

    if (filter?.provider) {
      result = result.filter((e) => e.provider === filter.provider);
    }
    if (filter?.newState) {
      result = result.filter((e) => e.newState === filter.newState);
    }
    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  onStateChange(callback: (event: CircuitBreakerEvent) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  reset(provider: string): void {
    this.circuits.delete(provider);
    this.adaptiveThresholds.delete(provider);
    logger.info('Circuit breaker reset', { provider });
  }

  resetAll(): void {
    this.circuits.clear();
    this.adaptiveThresholds.clear();
    logger.info('All circuit breakers reset');
  }

  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  private getOrCreateMetrics(provider: string): CircuitBreakerMetrics {
    if (!this.circuits.has(provider)) {
      this.circuits.set(provider, {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        totalRequests: 0,
        totalFailures: 0,
        totalSuccesses: 0,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        lastFailureTime: 0,
        lastSuccessTime: 0,
        lastStateChangeTime: Date.now(),
        nextAttemptTime: 0,
        failureRate: 0,
        successRate: 1,
      });
    }
    return this.circuits.get(provider)!;
  }

  private transitionState(provider: string, newState: CircuitBreakerState, reason: string): void {
    const metrics = this.getOrCreateMetrics(provider);
    const previousState = metrics.state;

    if (previousState === newState) return;

    metrics.state = newState;
    metrics.lastStateChangeTime = Date.now();

    const event: CircuitBreakerEvent = {
      provider,
      previousState,
      newState,
      reason,
      timestamp: Date.now(),
    };

    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    logger.info('Circuit breaker state change', {
      provider,
      previousState,
      newState,
      reason,
    });

    for (const callback of this.stateChangeCallbacks) {
      try {
        callback(event);
      } catch (error) {
        logger.error('State change callback error', { error: (error as Error).message });
      }
    }
  }

  private updateRates(metrics: CircuitBreakerMetrics): void {
    if (metrics.totalRequests > 0) {
      metrics.failureRate = metrics.totalFailures / metrics.totalRequests;
      metrics.successRate = metrics.totalSuccesses / metrics.totalRequests;
    }
  }

  private getFailureThreshold(provider: string): number {
    const adaptive = this.adaptiveThresholds.get(provider);
    return adaptive?.failureThreshold ?? this.config.failureThreshold;
  }

  private getResetTimeout(provider: string): number {
    const adaptive = this.adaptiveThresholds.get(provider);
    return adaptive?.resetTimeoutMs ?? this.config.resetTimeoutMs;
  }

  private updateAdaptiveMetrics(provider: string, isFailure: boolean): void {
    if (!this.adaptiveThresholds.has(provider)) {
      this.adaptiveThresholds.set(provider, {
        failureThreshold: this.config.failureThreshold,
        resetTimeoutMs: this.config.resetTimeoutMs,
        recentRequests: 0,
        recentFailures: 0,
      });
    }

    const adaptive = this.adaptiveThresholds.get(provider)!;
    adaptive.recentRequests++;
    if (isFailure) adaptive.recentFailures++;
  }

  private adaptThresholds(provider: string): void {
    const adaptive = this.adaptiveThresholds.get(provider);
    if (!adaptive || adaptive.recentRequests < this.config.adaptiveMinRequests) return;

    const recentFailureRate = adaptive.recentFailures / adaptive.recentRequests;

    if (recentFailureRate > 0.3) {
      adaptive.failureThreshold = Math.max(2, Math.floor(this.config.failureThreshold * 0.7));
      adaptive.resetTimeoutMs = Math.min(300000, Math.floor(this.config.resetTimeoutMs * 1.5));
    } else if (recentFailureRate < 0.05) {
      adaptive.failureThreshold = Math.min(20, Math.floor(this.config.failureThreshold * 1.3));
      adaptive.resetTimeoutMs = Math.max(10000, Math.floor(this.config.resetTimeoutMs * 0.7));
    }

    const windowStart = Date.now() - this.config.adaptiveWindowMs;
    if (adaptive.recentRequests > 1000) {
      adaptive.recentRequests = Math.floor(adaptive.recentRequests / 2);
      adaptive.recentFailures = Math.floor(adaptive.recentFailures / 2);
    }
  }
}
