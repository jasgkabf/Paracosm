import type { LLMModel } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";

const logger = new Logger("LatencyOptimizer");

interface LatencyMeasurement {
  modelId: string;
  latencyMs: number;
  timestamp: number;
  success: boolean;
}

export class LatencyOptimizer {
  private measurements: Map<string, LatencyMeasurement[]> = new Map();
  private maxMeasurements: number = 1000;
  private predictionWeights: Map<string, number> = new Map();

  measureLatency(modelId: string, latencyMs: number, success: boolean = true): void {
    if (!this.measurements.has(modelId)) {
      this.measurements.set(modelId, []);
    }
    const history = this.measurements.get(modelId)!;
    history.push({
      modelId,
      latencyMs,
      timestamp: Date.now(),
      success,
    });
    if (history.length > this.maxMeasurements) {
      history.shift();
    }
  }

  predictLatency(model: LLMModel): number {
    const history = this.measurements.get(model.modelId);
    if (!history || history.length === 0) {
      return model.latencyMs;
    }

    const recentMeasurements = this.getRecentMeasurements(model.modelId, 60000);
    if (recentMeasurements.length === 0) {
      return model.latencyMs;
    }

    const successful = recentMeasurements.filter((m) => m.success);
    if (successful.length === 0) {
      return model.latencyMs * 2;
    }

    const avgLatency = successful.reduce((sum, m) => sum + m.latencyMs, 0) / successful.length;
    const weight = this.predictionWeights.get(model.modelId) ?? 0.5;
    return avgLatency * weight + model.latencyMs * (1 - weight);
  }

  selectFastest(models: LLMModel[]): LLMModel | null {
    if (models.length === 0) {
      return null;
    }

    let fastest: LLMModel | null = null;
    let minLatency = Infinity;

    for (const model of models) {
      const predictedLatency = this.predictLatency(model);
      if (predictedLatency < minLatency) {
        minLatency = predictedLatency;
        fastest = model;
      }
    }

    return fastest;
  }

  rankByLatency(models: LLMModel[]): { model: LLMModel; predictedLatency: number }[] {
    return models
      .map((model) => ({
        model,
        predictedLatency: this.predictLatency(model),
      }))
      .sort((a, b) => a.predictedLatency - b.predictedLatency);
  }

  getLatencyStats(modelId: string): {
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
    sampleSize: number;
  } | null {
    const history = this.measurements.get(modelId);
    if (!history || history.length === 0) {
      return null;
    }

    const latencies = history.filter((m) => m.success).map((m) => m.latencyMs).sort((a, b) => a - b);
    if (latencies.length === 0) {
      return null;
    }

    const sum = latencies.reduce((a, b) => a + b, 0);
    return {
      avg: sum / latencies.length,
      min: latencies[0],
      max: latencies[latencies.length - 1],
      p50: latencies[Math.floor(latencies.length * 0.5)],
      p95: latencies[Math.floor(latencies.length * 0.95)],
      p99: latencies[Math.min(Math.floor(latencies.length * 0.99), latencies.length - 1)],
      sampleSize: latencies.length,
    };
  }

  setPredictionWeight(modelId: string, weight: number): void {
    this.predictionWeights.set(modelId, Math.max(0, Math.min(1, weight)));
  }

  private getRecentMeasurements(modelId: string, windowMs: number): LatencyMeasurement[] {
    const history = this.measurements.get(modelId);
    if (!history) {
      return [];
    }
    const cutoff = Date.now() - windowMs;
    return history.filter((m) => m.timestamp >= cutoff);
  }

  clearMeasurements(modelId?: string): void {
    if (modelId) {
      this.measurements.delete(modelId);
    } else {
      this.measurements.clear();
    }
  }
}
