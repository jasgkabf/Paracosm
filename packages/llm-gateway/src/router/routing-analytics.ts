import { createLogger } from '@paracosm/shared';
import type { RoutingDecision, RoutingContext } from './smart-router.js';

const logger = createLogger('RoutingAnalytics');

export interface RoutingAnalyticsEntry {
  timestamp: number;
  provider: string;
  model: string;
  taskType: string;
  reason: string;
  estimatedCost: number;
  estimatedLatency: number;
  actualLatency?: number;
  actualCost?: number;
  success?: boolean;
}

export interface RoutingAnalyticsSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  totalCost: number;
  providerDistribution: Record<string, number>;
  modelDistribution: Record<string, number>;
  taskTypeDistribution: Record<string, number>;
  strategyDistribution: Record<string, number>;
  averageCostPerRequest: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
}

export class RoutingAnalytics {
  private entries: RoutingAnalyticsEntry[] = [];
  private maxEntries: number = 10000;

  recordDecision(decision: RoutingDecision, context: RoutingContext): void {
    const entry: RoutingAnalyticsEntry = {
      timestamp: Date.now(),
      provider: decision.provider,
      model: decision.model,
      taskType: context.taskType,
      reason: decision.reason,
      estimatedCost: decision.estimatedCost,
      estimatedLatency: decision.estimatedLatency,
    };

    this.entries.push(entry);

    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  recordOutcome(provider: string, model: string, latencyMs: number, cost: number, success: boolean): void {
    const entry = [...this.entries].reverse().find(
      (e) => e.provider === provider && e.model === model && e.success === undefined,
    );

    if (entry) {
      entry.actualLatency = latencyMs;
      entry.actualCost = cost;
      entry.success = success;
    }
  }

  getSummary(timeRangeMs?: number): RoutingAnalyticsSummary {
    const cutoff = timeRangeMs ? Date.now() - timeRangeMs : 0;
    const filtered = this.entries.filter((e) => e.timestamp >= cutoff);

    const totalRequests = filtered.length;
    const completed = filtered.filter((e) => e.success !== undefined);
    const successful = completed.filter((e) => e.success === true);
    const failed = completed.filter((e) => e.success === false);

    const latencies = completed
      .filter((e) => e.actualLatency !== undefined)
      .map((e) => e.actualLatency!)
      .sort((a, b) => a - b);

    const totalCost = completed.reduce((sum, e) => sum + (e.actualCost ?? 0), 0);

    const providerDistribution: Record<string, number> = {};
    const modelDistribution: Record<string, number> = {};
    const taskTypeDistribution: Record<string, number> = {};
    const strategyDistribution: Record<string, number> = {};

    for (const entry of filtered) {
      providerDistribution[entry.provider] = (providerDistribution[entry.provider] ?? 0) + 1;
      modelDistribution[entry.model] = (modelDistribution[entry.model] ?? 0) + 1;
      taskTypeDistribution[entry.taskType] = (taskTypeDistribution[entry.taskType] ?? 0) + 1;

      const strategy = entry.reason.split(':')[0];
      strategyDistribution[strategy] = (strategyDistribution[strategy] ?? 0) + 1;
    }

    return {
      totalRequests,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      averageLatency: latencies.length > 0
        ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
        : 0,
      totalCost,
      providerDistribution,
      modelDistribution,
      taskTypeDistribution,
      strategyDistribution,
      averageCostPerRequest: completed.length > 0 ? totalCost / completed.length : 0,
      p50Latency: this.percentile(latencies, 50),
      p95Latency: this.percentile(latencies, 95),
      p99Latency: this.percentile(latencies, 99),
    };
  }

  getRecentEntries(count: number = 100): RoutingAnalyticsEntry[] {
    return this.entries.slice(-count);
  }

  getEntriesByProvider(provider: string): RoutingAnalyticsEntry[] {
    return this.entries.filter((e) => e.provider === provider);
  }

  getEntriesByModel(model: string): RoutingAnalyticsEntry[] {
    return this.entries.filter((e) => e.model === model);
  }

  getEntriesByTaskType(taskType: string): RoutingAnalyticsEntry[] {
    return this.entries.filter((e) => e.taskType === taskType);
  }

  getProviderSuccessRates(): Record<string, { total: number; success: number; rate: number }> {
    const result: Record<string, { total: number; success: number; rate: number }> = {};

    for (const entry of this.entries) {
      if (entry.success === undefined) continue;

      if (!result[entry.provider]) {
        result[entry.provider] = { total: 0, success: 0, rate: 0 };
      }

      result[entry.provider].total++;
      if (entry.success) {
        result[entry.provider].success++;
      }
    }

    for (const provider of Object.keys(result)) {
      const data = result[provider];
      data.rate = data.total > 0 ? data.success / data.total : 0;
    }

    return result;
  }

  getCostTrend(intervalMs: number = 3600000, periods: number = 24): Array<{ period: number; cost: number }> {
    const now = Date.now();
    const trend: Array<{ period: number; cost: number }> = [];

    for (let i = periods - 1; i >= 0; i--) {
      const periodEnd = now - i * intervalMs;
      const periodStart = periodEnd - intervalMs;

      const cost = this.entries
        .filter((e) => e.timestamp >= periodStart && e.timestamp < periodEnd && e.actualCost !== undefined)
        .reduce((sum, e) => sum + (e.actualCost ?? 0), 0);

      trend.push({ period: periodStart, cost });
    }

    return trend;
  }

  clear(): void {
    this.entries = [];
  }

  getEntryCount(): number {
    return this.entries.length;
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }
}
