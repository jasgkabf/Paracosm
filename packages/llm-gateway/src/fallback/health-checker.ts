import { createLogger } from '@paracosm/shared';
import type { LLMProvider } from '@paracosm/shared';

const logger = createLogger('HealthChecker');

export interface HealthCheckConfig {
  intervalMs: number;
  timeoutMs: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
  degradationThreshold: number;
}

export interface ProviderHealthStatus {
  provider: string;
  isAvailable: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  healthScore: number;
  averageLatencyMs: number;
  errorRate: number;
  successRate: number;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  totalChecks: number;
  totalSuccesses: number;
  totalFailures: number;
  lastCheckTime: number;
  lastSuccessTime: number;
  lastFailureTime: number;
  uptime: number;
}

export interface HealthCheckResult {
  provider: string;
  healthy: boolean;
  latencyMs: number;
  timestamp: number;
  error?: string;
  details?: Record<string, unknown>;
}

type HealthCheckFn = (provider: string) => Promise<{ healthy: boolean; latencyMs: number; error?: string }>;

export class HealthChecker {
  private config: HealthCheckConfig;
  private healthStatus: Map<string, ProviderHealthStatus> = new Map();
  private checkResults: Map<string, HealthCheckResult[]> = new Map();
  private maxResultsPerProvider: number = 100;
  private checkFns: Map<string, HealthCheckFn> = new Map();
  private defaultCheckFn: HealthCheckFn | null = null;
  private scheduleTimer: ReturnType<typeof setInterval> | null = null;
  private alertCallbacks: Array<(provider: string, status: ProviderHealthStatus) => void> = [];
  private aggregateWindowMs: number = 300000;

  constructor(config?: Partial<HealthCheckConfig>) {
    this.config = {
      intervalMs: config?.intervalMs ?? 30000,
      timeoutMs: config?.timeoutMs ?? 10000,
      healthyThreshold: config?.healthyThreshold ?? 3,
      unhealthyThreshold: config?.unhealthyThreshold ?? 3,
      degradationThreshold: config?.degradationThreshold ?? 0.7,
    };
  }

  registerCheck(provider: string, checkFn: HealthCheckFn): void {
    this.checkFns.set(provider, checkFn);
    if (!this.healthStatus.has(provider)) {
      this.initProvider(provider);
    }
    logger.info('Health check registered', { provider });
  }

  setDefaultCheck(checkFn: HealthCheckFn): void {
    this.defaultCheckFn = checkFn;
  }

  async check(provider: string): Promise<HealthCheckResult> {
    const checkFn = this.checkFns.get(provider) ?? this.defaultCheckFn;

    if (!checkFn) {
      const result: HealthCheckResult = {
        provider,
        healthy: false,
        latencyMs: 0,
        timestamp: Date.now(),
        error: 'No health check function registered',
      };
      this.recordResult(result);
      return result;
    }

    const startTime = Date.now();
    try {
      const timeoutPromise = new Promise<{ healthy: false; latencyMs: number; error: string }>(
        (resolve) => setTimeout(
          () => resolve({ healthy: false, latencyMs: Date.now() - startTime, error: 'Health check timeout' }),
          this.config.timeoutMs,
        ),
      );

      const result = await Promise.race([checkFn(provider), timeoutPromise]);
      const latencyMs = Date.now() - startTime;

      const healthResult: HealthCheckResult = {
        provider,
        healthy: result.healthy,
        latencyMs: result.latencyMs ?? latencyMs,
        timestamp: Date.now(),
        error: result.error,
      };

      this.recordResult(healthResult);
      this.updateStatus(provider, healthResult);

      return healthResult;
    } catch (error) {
      const healthResult: HealthCheckResult = {
        provider,
        healthy: false,
        latencyMs: Date.now() - startTime,
        timestamp: Date.now(),
        error: (error as Error).message,
      };

      this.recordResult(healthResult);
      this.updateStatus(provider, healthResult);

      return healthResult;
    }
  }

  async checkAll(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();
    const providers = Array.from(this.healthStatus.keys());

    const checkPromises = providers.map(async (provider) => {
      const result = await this.check(provider);
      results.set(provider, result);
    });

    await Promise.allSettled(checkPromises);
    return results;
  }

  schedule(): void {
    if (this.scheduleTimer) return;

    this.scheduleTimer = setInterval(async () => {
      try {
        await this.checkAll();
      } catch (error) {
        logger.error('Scheduled health check error', { error: (error as Error).message });
      }
    }, this.config.intervalMs);

    logger.info('Health check scheduled', { intervalMs: this.config.intervalMs });
  }

  stopSchedule(): void {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
      logger.info('Health check schedule stopped');
    }
  }

  getHealth(provider: string): ProviderHealthStatus | undefined {
    return this.healthStatus.get(provider);
  }

  getAllHealth(): Map<string, ProviderHealthStatus> {
    return new Map(this.healthStatus);
  }

  aggregate(): {
    totalProviders: number;
    healthyProviders: number;
    degradedProviders: number;
    unhealthyProviders: number;
    unknownProviders: number;
    overallHealthScore: number;
    averageLatencyMs: number;
  } {
    let totalProviders = 0;
    let healthyProviders = 0;
    let degradedProviders = 0;
    let unhealthyProviders = 0;
    let unknownProviders = 0;
    let totalHealthScore = 0;
    let totalLatency = 0;
    let latencyCount = 0;

    for (const status of this.healthStatus.values()) {
      totalProviders++;
      totalHealthScore += status.healthScore;

      switch (status.status) {
        case 'healthy':
          healthyProviders++;
          break;
        case 'degraded':
          degradedProviders++;
          break;
        case 'unhealthy':
          unhealthyProviders++;
          break;
        default:
          unknownProviders++;
      }

      if (status.averageLatencyMs > 0) {
        totalLatency += status.averageLatencyMs;
        latencyCount++;
      }
    }

    return {
      totalProviders,
      healthyProviders,
      degradedProviders,
      unhealthyProviders,
      unknownProviders,
      overallHealthScore: totalProviders > 0 ? totalHealthScore / totalProviders : 0,
      averageLatencyMs: latencyCount > 0 ? totalLatency / latencyCount : 0,
    };
  }

  threshold(provider: string): {
    isHealthy: boolean;
    isDegraded: boolean;
    isUnhealthy: boolean;
    healthScore: number;
  } {
    const status = this.healthStatus.get(provider);
    if (!status) {
      return { isHealthy: false, isDegraded: false, isUnhealthy: true, healthScore: 0 };
    }

    return {
      isHealthy: status.status === 'healthy',
      isDegraded: status.status === 'degraded',
      isUnhealthy: status.status === 'unhealthy',
      healthScore: status.healthScore,
    };
  }

  onHealthChange(callback: (provider: string, status: ProviderHealthStatus) => void): void {
    this.alertCallbacks.push(callback);
  }

  getResults(provider: string, limit?: number): HealthCheckResult[] {
    const results = this.checkResults.get(provider) ?? [];
    return limit ? results.slice(-limit) : [...results];
  }

  getConfig(): HealthCheckConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...updates };
    if (this.scheduleTimer) {
      this.stopSchedule();
      this.schedule();
    }
  }

  removeProvider(provider: string): boolean {
    const deleted = this.healthStatus.delete(provider);
    this.checkResults.delete(provider);
    this.checkFns.delete(provider);
    return deleted;
  }

  destroy(): void {
    this.stopSchedule();
    this.healthStatus.clear();
    this.checkResults.clear();
    this.checkFns.clear();
    this.alertCallbacks = [];
  }

  private initProvider(provider: string): void {
    this.healthStatus.set(provider, {
      provider,
      isAvailable: true,
      status: 'unknown',
      healthScore: 1.0,
      averageLatencyMs: 0,
      errorRate: 0,
      successRate: 1.0,
      consecutiveSuccesses: 0,
      consecutiveFailures: 0,
      totalChecks: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      lastCheckTime: 0,
      lastSuccessTime: 0,
      lastFailureTime: 0,
      uptime: 1.0,
    });
  }

  private recordResult(result: HealthCheckResult): void {
    if (!this.checkResults.has(result.provider)) {
      this.checkResults.set(result.provider, []);
    }
    const results = this.checkResults.get(result.provider)!;
    results.push(result);
    if (results.length > this.maxResultsPerProvider) {
      results.splice(0, results.length - this.maxResultsPerProvider);
    }
  }

  private updateStatus(provider: string, result: HealthCheckResult): void {
    let status = this.healthStatus.get(provider);
    if (!status) {
      this.initProvider(provider);
      status = this.healthStatus.get(provider)!;
    }

    const previousStatus = status.status;
    status.totalChecks++;
    status.lastCheckTime = result.timestamp;

    if (result.healthy) {
      status.consecutiveSuccesses++;
      status.consecutiveFailures = 0;
      status.totalSuccesses++;
      status.lastSuccessTime = result.timestamp;
    } else {
      status.consecutiveFailures++;
      status.consecutiveSuccesses = 0;
      status.totalFailures++;
      status.lastFailureTime = result.timestamp;
    }

    const windowStart = Date.now() - this.aggregateWindowMs;
    const recentResults = (this.checkResults.get(provider) ?? [])
      .filter((r) => r.timestamp > windowStart);

    if (recentResults.length > 0) {
      const successes = recentResults.filter((r) => r.healthy).length;
      status.successRate = successes / recentResults.length;
      status.errorRate = 1 - status.successRate;

      const latencyResults = recentResults.filter((r) => r.healthy && r.latencyMs > 0);
      if (latencyResults.length > 0) {
        status.averageLatencyMs = latencyResults.reduce((sum, r) => sum + r.latencyMs, 0) / latencyResults.length;
      }
    }

    status.healthScore = this.calculateHealthScore(status);
    status.isAvailable = status.healthScore > 0;

    if (status.consecutiveFailures >= this.config.unhealthyThreshold) {
      status.status = 'unhealthy';
      status.isAvailable = false;
    } else if (status.consecutiveSuccesses >= this.config.healthyThreshold) {
      if (status.healthScore >= this.config.degradationThreshold) {
        status.status = 'healthy';
        status.isAvailable = true;
      } else {
        status.status = 'degraded';
        status.isAvailable = true;
      }
    } else if (status.healthScore < this.config.degradationThreshold) {
      status.status = 'degraded';
      status.isAvailable = true;
    }

    if (status.totalChecks > 0) {
      status.uptime = status.totalSuccesses / status.totalChecks;
    }

    if (previousStatus !== status.status) {
      logger.info('Provider health status changed', {
        provider,
        previous: previousStatus,
        current: status.status,
        healthScore: status.healthScore.toFixed(2),
      });

      for (const callback of this.alertCallbacks) {
        try {
          callback(provider, { ...status });
        } catch (error) {
          logger.error('Health change callback error', { error: (error as Error).message });
        }
      }
    }
  }

  private calculateHealthScore(status: ProviderHealthStatus): number {
    let score = 50;

    if (status.successRate > 0.99) score += 30;
    else if (status.successRate > 0.95) score += 20;
    else if (status.successRate > 0.9) score += 10;
    else if (status.successRate < 0.5) score -= 30;
    else if (status.successRate < 0.8) score -= 15;

    if (status.averageLatencyMs > 0 && status.averageLatencyMs < 500) score += 15;
    else if (status.averageLatencyMs < 1000) score += 10;
    else if (status.averageLatencyMs < 3000) score += 0;
    else if (status.averageLatencyMs > 10000) score -= 15;
    else if (status.averageLatencyMs > 5000) score -= 10;

    if (status.consecutiveFailures > 0) score -= status.consecutiveFailures * 5;
    if (status.consecutiveSuccesses > 3) score += 5;

    return Math.max(0, Math.min(100, score)) / 100;
  }
}
