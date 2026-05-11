import { EventEmitter } from "node:events";
import type { FallbackChain, FallbackConfig, LLMResponse, LLMModelId, ProviderHealth } from "@paracosm/shared";
import { Result, ok, err } from "@paracosm/shared";
import { LLMError } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";
import { HealthChecker } from "./health-checker.js";
import { CircuitBreaker } from "./circuit-breaker.js";
import { DegradationHandler } from "./degradation-handler.js";
import { RecoveryManager } from "./recovery-manager.js";

const logger = new Logger("FallbackEngine");

export interface FallbackContext {
  modelId: LLMModelId;
  providerId: string;
  error?: Error;
  latencyMs?: number;
  statusCode?: number;
}

export interface FallbackResult {
  switched: boolean;
  fromModelId: LLMModelId;
  toModelId: LLMModelId | null;
  reason: string;
  chainId: string;
  attemptIndex: number;
}

export class FallbackEngine extends EventEmitter {
  private config: FallbackConfig;
  private chains: Map<string, FallbackChain> = new Map();
  private healthChecker: HealthChecker;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private degradationHandler: DegradationHandler;
  private recoveryManager: RecoveryManager;
  private activeFallbacks: Map<string, { chainId: string; currentIndex: number; startTime: number }> = new Map();

  constructor(config: FallbackConfig) {
    super();
    this.config = config;
    this.healthChecker = new HealthChecker();
    this.degradationHandler = new DegradationHandler();
    this.recoveryManager = new RecoveryManager();

    for (const chain of config.chains) {
      this.chains.set(chain.id, chain);
    }

    for (const chain of config.chains) {
      for (const modelId of chain.modelIds) {
        if (!this.circuitBreakers.has(modelId as string)) {
          this.circuitBreakers.set(modelId as string, new CircuitBreaker({
            failureThreshold: 5,
            resetTimeoutMs: 60000,
            halfOpenMaxAttempts: 3,
          }));
        }
      }
    }
  }

  check(context: FallbackContext): Result<FallbackResult, LLMError> {
    const shouldFallback = this.shouldFallback(context);
    if (!shouldFallback) {
      return ok({
        switched: false,
        fromModelId: context.modelId,
        toModelId: null,
        reason: "No fallback needed",
        chainId: "",
        attemptIndex: 0,
      });
    }

    const chain = this.findChainForModel(context.modelId);
    if (!chain) {
      return err(new LLMError(`No fallback chain found for model: ${context.modelId}`, {
        modelId: context.modelId as string,
      }));
    }

    const nextModel = this.getNextModel(chain, context.modelId);
    if (!nextModel) {
      this.degradationHandler.detect("all_models_failed", {
        chainId: chain.id,
        originalModel: context.modelId,
      });

      return ok({
        switched: false,
        fromModelId: context.modelId,
        toModelId: null,
        reason: "No more models in fallback chain",
        chainId: chain.id,
        attemptIndex: chain.modelIds.indexOf(context.modelId),
      });
    }

    const result: FallbackResult = {
      switched: true,
      fromModelId: context.modelId,
      toModelId: nextModel,
      reason: this.getFallbackReason(context),
      chainId: chain.id,
      attemptIndex: chain.modelIds.indexOf(nextModel),
    };

    this.emit("fallback", result);
    logger.info(`Falling back from ${context.modelId} to ${nextModel}: ${result.reason}`);
    return ok(result);
  }

  switch(fromModelId: LLMModelId, toModelId: LLMModelId, reason: string): FallbackResult {
    const result: FallbackResult = {
      switched: true,
      fromModelId,
      toModelId,
      reason,
      chainId: "",
      attemptIndex: 0,
    };

    this.emit("switch", result);
    return result;
  }

  recover(modelId: LLMModelId): void {
    const breaker = this.circuitBreakers.get(modelId as string);
    if (breaker) {
      breaker.recordSuccess();
    }

    this.recoveryManager.recover(modelId as string);
    this.degradationHandler.recover(modelId as string);
    this.emit("recovered", { modelId });
    logger.info(`Model ${modelId} recovered`);
  }

  report(): {
    chains: { id: string; modelCount: number }[];
    circuitStates: Map<string, { state: string; failures: number }>;
    degradationLevel: string;
    activeFallbacks: number;
  } {
    const circuitStates = new Map<string, { state: string; failures: number }>();
    for (const [modelId, breaker] of this.circuitBreakers.entries()) {
      const state = breaker.getState();
      circuitStates.set(modelId, { state: state.state, failures: state.failureCount });
    }

    return {
      chains: Array.from(this.chains.values()).map((c) => ({
        id: c.id,
        modelCount: c.modelIds.length,
      })),
      circuitStates,
      degradationLevel: this.degradationHandler.getLevel(),
      activeFallbacks: this.activeFallbacks.size,
    };
  }

  autoHeal(): void {
    for (const [modelId, breaker] of this.circuitBreakers.entries()) {
      const state = breaker.getState();
      if (state.state === "half_open") {
        this.recoveryManager.testRecovery(modelId, async () => {
          const healthResult = await this.healthChecker.check(modelId);
          return healthResult.ok && healthResult.value.isHealthy;
        });
      }
    }

    this.degradationHandler.autoRecover();
  }

  getHealthChecker(): HealthChecker {
    return this.healthChecker;
  }

  getCircuitBreaker(modelId: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(modelId);
  }

  getDegradationHandler(): DegradationHandler {
    return this.degradationHandler;
  }

  getRecoveryManager(): RecoveryManager {
    return this.recoveryManager;
  }

  private shouldFallback(context: FallbackContext): boolean {
    if (!this.config.enableAutomaticFallback) {
      return false;
    }

    if (context.error && this.config.fallbackOnError) {
      return true;
    }

    if (context.statusCode === 408 && this.config.fallbackOnTimeout) {
      return true;
    }

    if (context.statusCode === 429 && this.config.fallbackOnRateLimit) {
      return true;
    }

    if (context.statusCode === 451 && this.config.fallbackOnContentFilter) {
      return true;
    }

    if (context.latencyMs && context.latencyMs > 30000 && this.config.fallbackOnTimeout) {
      return true;
    }

    const breaker = this.circuitBreakers.get(context.modelId as string);
    if (breaker) {
      const state = breaker.getState();
      if (state.state === "open") {
        return true;
      }
    }

    return false;
  }

  private findChainForModel(modelId: LLMModelId): FallbackChain | null {
    for (const chain of this.chains.values()) {
      if (chain.modelIds.includes(modelId)) {
        return chain;
      }
    }

    const defaultChain = this.chains.get(this.config.defaultChainId);
    return defaultChain ?? null;
  }

  private getNextModel(chain: FallbackChain, currentModelId: LLMModelId): LLMModelId | null {
    const currentIndex = chain.modelIds.indexOf(currentModelId);
    if (currentIndex === -1) {
      return chain.modelIds[0] ?? null;
    }

    for (let i = currentIndex + 1; i < chain.modelIds.length; i++) {
      const candidateModel = chain.modelIds[i];
      const breaker = this.circuitBreakers.get(candidateModel as string);
      if (breaker) {
        const state = breaker.getState();
        if (state.state === "open") {
          continue;
        }
      }
      return candidateModel;
    }

    return null;
  }

  private getFallbackReason(context: FallbackContext): string {
    if (context.error) {
      return `Error: ${context.error.message}`;
    }
    if (context.statusCode === 429) {
      return "Rate limit exceeded";
    }
    if (context.statusCode === 408) {
      return "Request timeout";
    }
    if (context.latencyMs && context.latencyMs > 30000) {
      return `High latency: ${context.latencyMs}ms`;
    }
    return "Automatic fallback triggered";
  }
}
