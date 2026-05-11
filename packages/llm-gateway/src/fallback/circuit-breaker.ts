import { EventEmitter } from "node:events";
import { Logger } from "@paracosm/shared";

const logger = new Logger("CircuitBreaker");

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
  monitoringWindowMs: number;
}

interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  openedAt: number;
  halfOpenAttempts: number;
  totalFailures: number;
  totalSuccesses: number;
  recentResults: { success: boolean; timestamp: number }[];
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenMaxAttempts: 3,
  monitoringWindowMs: 120000,
};

export class CircuitBreaker extends EventEmitter {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      state: "closed",
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      openedAt: 0,
      halfOpenAttempts: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      recentResults: [],
    };
  }

  recordFailure(): void {
    const now = Date.now();
    this.state.failureCount++;
    this.state.totalFailures++;
    this.state.lastFailureTime = now;
    this.state.recentResults.push({ success: false, timestamp: now });
    this.trimRecentResults();

    if (this.state.state === "half_open") {
      this.open();
      return;
    }

    const recentFailures = this.state.recentResults.filter(
      (r) => !r.success && r.timestamp >= now - this.config.monitoringWindowMs
    );

    if (recentFailures.length >= this.config.failureThreshold) {
      this.open();
    }

    this.emit("failure", { failureCount: this.state.failureCount, state: this.state.state });
  }

  recordSuccess(): void {
    const now = Date.now();
    this.state.successCount++;
    this.state.totalSuccesses++;
    this.state.lastSuccessTime = now;
    this.state.recentResults.push({ success: true, timestamp: now });
    this.trimRecentResults();

    if (this.state.state === "half_open") {
      this.state.halfOpenAttempts++;
      if (this.state.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        this.close();
      }
    }

    if (this.state.state === "closed") {
      this.state.failureCount = 0;
    }

    this.emit("success", { successCount: this.state.successCount, state: this.state.state });
  }

  evaluate(): CircuitState {
    if (this.state.state === "open") {
      const elapsed = Date.now() - this.state.openedAt;
      if (elapsed >= this.config.resetTimeoutMs) {
        this.halfOpen();
      }
    }

    return this.state.state;
  }

  open(): void {
    this.state.state = "open";
    this.state.openedAt = Date.now();
    this.state.halfOpenAttempts = 0;
    this.emit("opened", { openedAt: this.state.openedAt, failureCount: this.state.failureCount });
    logger.warn(`Circuit breaker opened after ${this.state.failureCount} failures`);
  }

  halfOpen(): void {
    this.state.state = "half_open";
    this.state.halfOpenAttempts = 0;
    this.emit("half_open", { failureCount: this.state.failureCount });
    logger.info("Circuit breaker entered half-open state");
  }

  close(): void {
    this.state.state = "closed";
    this.state.failureCount = 0;
    this.state.halfOpenAttempts = 0;
    this.emit("closed", { successCount: this.state.successCount });
    logger.info("Circuit breaker closed");
  }

  reset(): void {
    this.state = {
      state: "closed",
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      openedAt: 0,
      halfOpenAttempts: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      recentResults: [],
    };
    this.emit("reset");
    logger.info("Circuit breaker reset");
  }

  getState(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
    lastSuccessTime: number;
    openedAt: number;
    halfOpenAttempts: number;
    totalFailures: number;
    totalSuccesses: number;
  } {
    this.evaluate();
    return { ...this.state };
  }

  isAllowed(): boolean {
    const currentState = this.evaluate();
    return currentState === "closed" || currentState === "half_open";
  }

  private trimRecentResults(): void {
    const cutoff = Date.now() - this.config.monitoringWindowMs;
    this.state.recentResults = this.state.recentResults.filter((r) => r.timestamp >= cutoff);
    if (this.state.recentResults.length > 1000) {
      this.state.recentResults = this.state.recentResults.slice(-500);
    }
  }
}
