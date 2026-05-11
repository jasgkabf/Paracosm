import type { LLMModel, ProviderConfig } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";

const logger = new Logger("LoadBalancer");

export type LoadBalanceStrategy = "round_robin" | "weighted" | "least_loaded" | "random";

interface LoadState {
  activeRequests: number;
  totalRequests: number;
  lastUsedAt: number;
  avgLatencyMs: number;
  errorCount: number;
}

export class LoadBalancer {
  private loadStates: Map<string, LoadState> = new Map();
  private roundRobinIndex: number = 0;
  private weights: Map<string, number> = new Map();

  select(models: LLMModel[], strategy: LoadBalanceStrategy = "round_robin"): LLMModel | null {
    if (models.length === 0) {
      return null;
    }

    switch (strategy) {
      case "round_robin":
        return this.roundRobin(models);
      case "weighted":
        return this.weighted(models);
      case "least_loaded":
        return this.leastLoaded(models);
      case "random":
        return this.random(models);
      default:
        return this.roundRobin(models);
    }
  }

  roundRobin(models: LLMModel[]): LLMModel {
    const index = this.roundRobinIndex % models.length;
    this.roundRobinIndex = (this.roundRobinIndex + 1) % models.length;
    const selected = models[index];
    this.recordRequest(selected.modelId);
    return selected;
  }

  weighted(models: LLMModel[]): LLMModel {
    const totalWeight = models.reduce((sum, m) => {
      const weight = this.weights.get(m.modelId) ?? m.availability;
      return sum + weight;
    }, 0);

    if (totalWeight === 0) {
      return models[0];
    }

    let random = Math.random() * totalWeight;
    for (const model of models) {
      const weight = this.weights.get(model.modelId) ?? model.availability;
      random -= weight;
      if (random <= 0) {
        this.recordRequest(model.modelId);
        return model;
      }
    }

    const fallback = models[models.length - 1];
    this.recordRequest(fallback.modelId);
    return fallback;
  }

  leastLoaded(models: LLMModel[]): LLMModel {
    let leastLoaded = models[0];
    let minLoad = Infinity;

    for (const model of models) {
      const state = this.loadStates.get(model.modelId);
      const load = state?.activeRequests ?? 0;
      if (load < minLoad) {
        minLoad = load;
        leastLoaded = model;
      }
    }

    this.recordRequest(leastLoaded.modelId);
    return leastLoaded;
  }

  random(models: LLMModel[]): LLMModel {
    const index = Math.floor(Math.random() * models.length);
    const selected = models[index];
    this.recordRequest(selected.modelId);
    return selected;
  }

  keyRotation(apiKeys: string[]): string {
    if (apiKeys.length === 0) {
      throw new Error("No API keys available for rotation");
    }
    const index = this.roundRobinIndex % apiKeys.length;
    this.roundRobinIndex = (this.roundRobinIndex + 1) % apiKeys.length;
    return apiKeys[index];
  }

  setWeight(modelId: string, weight: number): void {
    this.weights.set(modelId, Math.max(0, weight));
  }

  getWeight(modelId: string): number {
    return this.weights.get(modelId) ?? 1;
  }

  recordRequest(modelId: string): void {
    const state = this.loadStates.get(modelId);
    if (state) {
      state.activeRequests++;
      state.totalRequests++;
      state.lastUsedAt = Date.now();
    } else {
      this.loadStates.set(modelId, {
        activeRequests: 1,
        totalRequests: 1,
        lastUsedAt: Date.now(),
        avgLatencyMs: 0,
        errorCount: 0,
      });
    }
  }

  recordCompletion(modelId: string, latencyMs: number, error?: boolean): void {
    const state = this.loadStates.get(modelId);
    if (state) {
      state.activeRequests = Math.max(0, state.activeRequests - 1);
      const alpha = 0.3;
      state.avgLatencyMs = state.avgLatencyMs * (1 - alpha) + latencyMs * alpha;
      if (error) {
        state.errorCount++;
      }
    }
  }

  getLoadState(modelId: string): LoadState | undefined {
    return this.loadStates.get(modelId);
  }

  getAllLoadStates(): Map<string, LoadState> {
    return new Map(this.loadStates);
  }

  reset(): void {
    this.loadStates.clear();
    this.roundRobinIndex = 0;
  }
}
