import { createLogger } from '@paracosm/shared';

const logger = createLogger('LatencyOptimizer');

export interface LatencyRecord {
  provider: string;
  model: string;
  latencyMs: number;
  timestamp: number;
  success: boolean;
}

export interface LatencyStats {
  provider: string;
  model: string;
  averageMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  sampleCount: number;
}

export class LatencyOptimizer {
  private records: Map<string, LatencyRecord[]> = new Map();
  private maxRecordsPerKey: number = 1000;
  private defaultLatencies: Map<string, number> = new Map();

  constructor() {
    this.defaultLatencies.set('openai', 1500);
    this.defaultLatencies.set('anthropic', 2000);
    this.defaultLatencies.set('google', 1200);
    this.defaultLatencies.set('mistral', 1800);
    this.defaultLatencies.set('cohere', 2000);
    this.defaultLatencies.set('deepseek', 3000);
    this.defaultLatencies.set('moonshot', 3500);
    this.defaultLatencies.set('ollama', 500);
    this.defaultLatencies.set('lmstudio', 400);
    this.defaultLatencies.set('vllm', 300);
    this.defaultLatencies.set('local', 500);
    this.defaultLatencies.set('custom', 2000);
  }

  updateLatency(provider: string, latencyMs: number): void {
    const current = this.defaultLatencies.get(provider) ?? 2000;
    const alpha = 0.2;
    this.defaultLatencies.set(provider, current * (1 - alpha) + latencyMs * alpha);
  }

  recordLatency(provider: string, model: string, latencyMs: number, success: boolean): void {
    const key = `${provider}:${model}`;
    const records = this.records.get(key) || [];

    records.push({
      provider,
      model,
      latencyMs,
      timestamp: Date.now(),
      success,
    });

    if (records.length > this.maxRecordsPerKey) {
      records.splice(0, records.length - this.maxRecordsPerKey);
    }

    this.records.set(key, records);
  }

  estimateLatency(provider: string, model: string): number {
    const key = `${provider}:${model}`;
    const records = this.records.get(key);

    if (!records || records.length === 0) {
      return this.defaultLatencies.get(provider) ?? 2000;
    }

    const recentRecords = records.filter(
      (r) => r.success && r.timestamp > Date.now() - 300000,
    );

    if (recentRecords.length === 0) {
      return this.defaultLatencies.get(provider) ?? 2000;
    }

    const avgLatency = recentRecords.reduce((sum, r) => sum + r.latencyMs, 0) / recentRecords.length;
    return avgLatency;
  }

  getStats(provider: string, model: string): LatencyStats | null {
    const key = `${provider}:${model}`;
    const records = this.records.get(key);

    if (!records || records.length === 0) {
      return null;
    }

    const successful = records.filter((r) => r.success).map((r) => r.latencyMs).sort((a, b) => a - b);

    if (successful.length === 0) {
      return null;
    }

    return {
      provider,
      model,
      averageMs: successful.reduce((sum, l) => sum + l, 0) / successful.length,
      p50Ms: this.percentile(successful, 50),
      p95Ms: this.percentile(successful, 95),
      p99Ms: this.percentile(successful, 99),
      minMs: successful[0],
      maxMs: successful[successful.length - 1],
      sampleCount: successful.length,
    };
  }

  getFastestProvider(
    candidates: Array<{ provider: string; model: string }>,
  ): { provider: string; model: string; estimatedLatency: number } | null {
    if (candidates.length === 0) return null;

    let fastest: { provider: string; model: string; estimatedLatency: number } | null = null;

    for (const candidate of candidates) {
      const latency = this.estimateLatency(candidate.provider, candidate.model);
      if (!fastest || latency < fastest.estimatedLatency) {
        fastest = {
          provider: candidate.provider,
          model: candidate.model,
          estimatedLatency: latency,
        };
      }
    }

    return fastest;
  }

  isLatencyAnomalous(provider: string, model: string, latencyMs: number): boolean {
    const stats = this.getStats(provider, model);
    if (!stats || stats.sampleCount < 5) return false;

    const threshold = stats.p95Ms * 2;
    return latencyMs > threshold;
  }

  clearOldRecords(maxAgeMs: number = 3600000): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleared = 0;

    for (const [key, records] of this.records.entries()) {
      const filtered = records.filter((r) => r.timestamp > cutoff);
      cleared += records.length - filtered.length;
      if (filtered.length > 0) {
        this.records.set(key, filtered);
      } else {
        this.records.delete(key);
      }
    }

    return cleared;
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }
}
