import { EventEmitter } from "node:events";
import { Result, ok, err } from "@paracosm/shared";
import { LLMError, isRetryable } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";
import { sleep } from "@paracosm/shared";

const logger = new Logger("RetryHandler");

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableCheck?: (error: Error) => boolean;
}

export interface RetryState {
  attempt: number;
  totalDelayMs: number;
  lastError: Error | null;
  startTime: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

export class RetryHandler extends EventEmitter {
  private options: RetryOptions;
  private circuitState: Map<string, { failures: number; lastFailureTime: number; open: boolean; openUntil: number }> = new Map();
  private circuitThreshold: number = 5;
  private circuitResetMs: number = 60000;

  constructor(options?: Partial<RetryOptions>) {
    super();
    this.options = { ...DEFAULT_RETRY_OPTIONS, ...options };
  }

  async retry<T>(fn: () => Promise<T>, key: string = "default"): Promise<Result<T, Error>> {
    const state: RetryState = {
      attempt: 0,
      totalDelayMs: 0,
      lastError: null,
      startTime: Date.now(),
    };

    if (this.isCircuitOpen(key)) {
      return err(new LLMError(`Circuit breaker open for ${key}`, { key, circuitOpen: true }));
    }

    while (state.attempt <= this.options.maxRetries) {
      try {
        const result = await fn();
        this.recordSuccess(key);
        this.emit("success", { key, attempt: state.attempt, totalDelayMs: state.totalDelayMs });
        return ok(result);
      } catch (error) {
        state.lastError = error instanceof Error ? error : new Error(String(error));
        state.attempt++;

        const shouldRetry = this.shouldRetry(state.lastError, state.attempt);
        if (!shouldRetry) {
          this.recordFailure(key);
          return err(state.lastError);
        }

        if (state.attempt > this.options.maxRetries) {
          this.recordFailure(key);
          this.emit("exhausted", { key, attempts: state.attempt, lastError: state.lastError });
          return err(state.lastError);
        }

        const delay = this.calculateBackoff(state.attempt);
        state.totalDelayMs += delay;

        this.emit("retry", { key, attempt: state.attempt, delayMs: delay, error: state.lastError });
        logger.info(`Retrying ${key}, attempt ${state.attempt}/${this.options.maxRetries}, delay ${delay}ms`);

        await sleep(delay);
      }
    }

    return err(state.lastError ?? new Error("Retry exhausted"));
  }

  backoff(attempt: number): number {
    return this.calculateBackoff(attempt);
  }

  exponential(attempt: number): number {
    const delay = this.options.baseDelayMs * Math.pow(this.options.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.options.maxDelayMs);
  }

  jitter(attempt: number): number {
    const baseDelay = this.exponential(attempt);
    const jitterRange = baseDelay * 0.25;
    return baseDelay + (Math.random() * 2 - 1) * jitterRange;
  }

  circuitBreaker(key: string): { open: boolean; failures: number; openUntil: number | null } {
    const state = this.circuitState.get(key);
    if (!state) {
      return { open: false, failures: 0, openUntil: null };
    }

    if (state.open && Date.now() >= state.openUntil) {
      state.open = false;
      state.failures = 0;
    }

    return {
      open: state.open,
      failures: state.failures,
      openUntil: state.open ? state.openUntil : null,
    };
  }

  private calculateBackoff(attempt: number): number {
    if (this.options.jitter) {
      return Math.max(0, Math.floor(this.jitter(attempt)));
    }
    return Math.min(this.exponential(attempt), this.options.maxDelayMs);
  }

  private shouldRetry(error: Error, attempt: number): boolean {
    if (attempt > this.options.maxRetries) {
      return false;
    }

    if (this.options.retryableCheck) {
      return this.options.retryableCheck(error);
    }

    if (error instanceof LLMError) {
      return isRetryable(error);
    }

    const message = error.message.toLowerCase();
    return message.includes("timeout") || message.includes("rate limit") || message.includes("429") || message.includes("503") || message.includes("500");
  }

  private isCircuitOpen(key: string): boolean {
    const state = this.circuitState.get(key);
    if (!state || !state.open) {
      return false;
    }
    if (Date.now() >= state.openUntil) {
      state.open = false;
      state.failures = 0;
      return false;
    }
    return true;
  }

  private recordFailure(key: string): void {
    const state = this.circuitState.get(key) ?? { failures: 0, lastFailureTime: 0, open: false, openUntil: 0 };
    state.failures++;
    state.lastFailureTime = Date.now();

    if (state.failures >= this.circuitThreshold) {
      state.open = true;
      state.openUntil = Date.now() + this.circuitResetMs;
      this.emit("circuit_open", { key, failures: state.failures, openUntil: state.openUntil });
      logger.warn(`Circuit breaker opened for ${key} after ${state.failures} failures`);
    }

    this.circuitState.set(key, state);
  }

  private recordSuccess(key: string): void {
    const state = this.circuitState.get(key);
    if (state) {
      state.failures = 0;
      state.open = false;
    }
  }
}
