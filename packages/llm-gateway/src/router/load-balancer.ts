import type { ProviderConfig } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('LoadBalancer');

export interface LoadBalancerStats {
  provider: string;
  totalRequests: number;
  activeRequests: number;
  lastRequestTime: number;
  averageLatency: number;
}

export class LoadBalancer {
  private currentIndex: number = 0;
  private stats: Map<string, LoadBalancerStats> = new Map();
  private weights: Map<string, number> = new Map();

  next(providers: ProviderConfig[]): ProviderConfig {
    if (providers.length === 0) {
      throw new Error('No providers available for load balancing');
    }

    const available = providers.filter((p) => {
      const stat = this.stats.get(p.provider);
      return !stat || stat.activeRequests < p.maxConcurrentRequests;
    });

    if (available.length === 0) {
      logger.warn('All providers at capacity, using least loaded');
      return this.selectLeastLoaded(providers);
    }

    if (available.length === 1) {
      return available[0];
    }

    const totalWeight = available.reduce((sum, p) => {
      return sum + (this.weights.get(p.provider) ?? 1);
    }, 0);

    let random = Math.random() * totalWeight;
    for (const provider of available) {
      const weight = this.weights.get(provider.provider) ?? 1;
      random -= weight;
      if (random <= 0) {
        this.recordRequest(provider.provider);
        return provider;
      }
    }

    const selected = available[this.currentIndex % available.length];
    this.currentIndex = (this.currentIndex + 1) % available.length;
    this.recordRequest(selected.provider);
    return selected;
  }

  setWeight(provider: string, weight: number): void {
    if (weight <= 0) {
      logger.warn('Weight must be positive', { provider, weight });
      return;
    }
    this.weights.set(provider, weight);
  }

  recordRequest(provider: string): void {
    const stat = this.stats.get(provider) || {
      provider,
      totalRequests: 0,
      activeRequests: 0,
      lastRequestTime: 0,
      averageLatency: 0,
    };
    stat.totalRequests++;
    stat.activeRequests++;
    stat.lastRequestTime = Date.now();
    this.stats.set(provider, stat);
  }

  recordCompletion(provider: string, latencyMs: number): void {
    const stat = this.stats.get(provider);
    if (!stat) return;

    stat.activeRequests = Math.max(0, stat.activeRequests - 1);
    const alpha = 0.3;
    stat.averageLatency = stat.averageLatency === 0
      ? latencyMs
      : stat.averageLatency * (1 - alpha) + latencyMs * alpha;
    this.stats.set(provider, stat);
  }

  recordError(provider: string): void {
    const stat = this.stats.get(provider);
    if (!stat) return;
    stat.activeRequests = Math.max(0, stat.activeRequests - 1);
    this.stats.set(provider, stat);
  }

  getStats(provider: string): LoadBalancerStats | undefined {
    return this.stats.get(provider);
  }

  getAllStats(): LoadBalancerStats[] {
    return Array.from(this.stats.values());
  }

  reset(): void {
    this.currentIndex = 0;
    this.stats.clear();
    this.weights.clear();
  }

  private selectLeastLoaded(providers: ProviderConfig[]): ProviderConfig {
    let leastLoaded = providers[0];
    let minActive = Infinity;

    for (const provider of providers) {
      const stat = this.stats.get(provider.provider);
      const active = stat?.activeRequests ?? 0;
      if (active < minActive) {
        minActive = active;
        leastLoaded = provider;
      }
    }

    return leastLoaded;
  }

  getProviderUtilization(provider: string): number {
    const stat = this.stats.get(provider);
    if (!stat) return 0;
    return stat.activeRequests;
  }

  getTotalActiveRequests(): number {
    let total = 0;
    for (const stat of this.stats.values()) {
      total += stat.activeRequests;
    }
    return total;
  }
}
