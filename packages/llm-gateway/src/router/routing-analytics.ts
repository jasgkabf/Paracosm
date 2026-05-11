import { EventEmitter } from "node:events";
import type { LLMModelId } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";

const logger = new Logger("RoutingAnalytics");

interface RoutingEvent {
  modelId: LLMModelId;
  strategy: string;
  decisionTimeMs: number;
  timestamp: number;
  success: boolean;
  costUsd?: number;
  latencyMs?: number;
}

interface RoutingStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageCost: number;
  averageLatencyMs: number;
  averageDecisionTimeMs: number;
  modelDistribution: Map<string, number>;
  strategyDistribution: Map<string, number>;
  errorRate: number;
}

export class RoutingAnalytics extends EventEmitter {
  private events: RoutingEvent[] = [];
  private maxEvents: number = 10000;
  private hourlyStats: Map<string, RoutingStats> = new Map();

  trackRouting(modelId: LLMModelId, strategy: string, decisionTimeMs: number): void {
    const event: RoutingEvent = {
      modelId,
      strategy,
      decisionTimeMs,
      timestamp: Date.now(),
      success: true,
    };
    this.addEvent(event);
    this.emit("routing", event);
  }

  trackResult(modelId: LLMModelId, success: boolean, costUsd?: number, latencyMs?: number): void {
    const event: RoutingEvent = {
      modelId,
      strategy: "",
      decisionTimeMs: 0,
      timestamp: Date.now(),
      success,
      costUsd,
      latencyMs,
    };
    this.addEvent(event);
    this.emit("result", event);
  }

  analyze(timeRangeMs?: number): RoutingStats {
    const events = timeRangeMs
      ? this.events.filter((e) => e.timestamp >= Date.now() - timeRangeMs)
      : this.events;

    const totalRequests = events.length;
    const successfulRequests = events.filter((e) => e.success).length;
    const failedRequests = totalRequests - successfulRequests;

    const costEvents = events.filter((e) => e.costUsd !== undefined);
    const averageCost = costEvents.length > 0
      ? costEvents.reduce((sum, e) => sum + (e.costUsd ?? 0), 0) / costEvents.length
      : 0;

    const latencyEvents = events.filter((e) => e.latencyMs !== undefined);
    const averageLatencyMs = latencyEvents.length > 0
      ? latencyEvents.reduce((sum, e) => sum + (e.latencyMs ?? 0), 0) / latencyEvents.length
      : 0;

    const decisionEvents = events.filter((e) => e.decisionTimeMs > 0);
    const averageDecisionTimeMs = decisionEvents.length > 0
      ? decisionEvents.reduce((sum, e) => sum + e.decisionTimeMs, 0) / decisionEvents.length
      : 0;

    const modelDistribution = new Map<string, number>();
    const strategyDistribution = new Map<string, number>();
    for (const event of events) {
      modelDistribution.set(event.modelId as string, (modelDistribution.get(event.modelId as string) ?? 0) + 1);
      if (event.strategy) {
        strategyDistribution.set(event.strategy, (strategyDistribution.get(event.strategy) ?? 0) + 1);
      }
    }

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageCost,
      averageLatencyMs,
      averageDecisionTimeMs,
      modelDistribution,
      strategyDistribution,
      errorRate: totalRequests > 0 ? failedRequests / totalRequests : 0,
    };
  }

  report(): {
    summary: RoutingStats;
    topModels: { modelId: string; count: number; percentage: number }[];
    topStrategies: { strategy: string; count: number; percentage: number }[];
    costTrend: { period: string; value: number }[];
    latencyTrend: { period: string; value: number }[];
  } {
    const stats = this.analyze();

    const topModels = Array.from(stats.modelDistribution.entries())
      .map(([modelId, count]) => ({
        modelId,
        count,
        percentage: stats.totalRequests > 0 ? (count / stats.totalRequests) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const topStrategies = Array.from(stats.strategyDistribution.entries())
      .map(([strategy, count]) => ({
        strategy,
        count,
        percentage: stats.totalRequests > 0 ? (count / stats.totalRequests) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const costTrend = this.calculateTrend("costUsd");
    const latencyTrend = this.calculateTrend("latencyMs");

    return { summary: stats, topModels, topStrategies, costTrend, latencyTrend };
  }

  optimize(): { recommendations: string[]; savingsEstimate: number } {
    const stats = this.analyze();
    const recommendations: string[] = [];
    let savingsEstimate = 0;

    if (stats.errorRate > 0.1) {
      recommendations.push(`High error rate (${(stats.errorRate * 100).toFixed(1)}%): consider reviewing model configurations`);
    }

    if (stats.averageLatencyMs > 10000) {
      recommendations.push(`High average latency (${stats.averageLatencyMs.toFixed(0)}ms): consider switching to faster models`);
    }

    const modelEntries = Array.from(stats.modelDistribution.entries());
    if (modelEntries.length === 1) {
      recommendations.push("Only one model in use: consider load balancing across multiple models for resilience");
    }

    const expensiveModel = modelEntries.find(([id]) => {
      const costEvents = this.events.filter((e) => e.modelId === id && e.costUsd !== undefined);
      return costEvents.length > 0 && costEvents.reduce((s, e) => s + (e.costUsd ?? 0), 0) / costEvents.length > 0.1;
    });
    if (expensiveModel) {
      recommendations.push(`Model ${expensiveModel[0]} has high average cost: consider using a cheaper alternative for simple tasks`);
      savingsEstimate += expensiveModel[1] * 0.02;
    }

    return { recommendations, savingsEstimate };
  }

  getRecentStats(windowMs: number = 300000): { averageCost: number; averageLatencyMs: number; errorRate: number } | null {
    const recent = this.events.filter((e) => e.timestamp >= Date.now() - windowMs);
    if (recent.length === 0) {
      return null;
    }
    const costEvents = recent.filter((e) => e.costUsd !== undefined);
    const latencyEvents = recent.filter((e) => e.latencyMs !== undefined);
    return {
      averageCost: costEvents.length > 0 ? costEvents.reduce((s, e) => s + (e.costUsd ?? 0), 0) / costEvents.length : 0,
      averageLatencyMs: latencyEvents.length > 0 ? latencyEvents.reduce((s, e) => s + (e.latencyMs ?? 0), 0) / latencyEvents.length : 0,
      errorRate: recent.filter((e) => !e.success).length / recent.length,
    };
  }

  private addEvent(event: RoutingEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  private calculateTrend(field: "costUsd" | "latencyMs"): { period: string; value: number }[] {
    const buckets = new Map<string, { sum: number; count: number }>();
    for (const event of this.events) {
      const value = event[field];
      if (value === undefined) continue;
      const date = new Date(event.timestamp);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const bucket = buckets.get(key) ?? { sum: 0, count: 0 };
      bucket.sum += value;
      bucket.count++;
      buckets.set(key, bucket);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, { sum, count }]) => ({ period, value: count > 0 ? sum / count : 0 }));
  }
}
