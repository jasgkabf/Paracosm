import { createLogger } from '@paracosm/shared';
import type { Middleware, MiddlewareContext } from './middleware-pipeline.js';

const logger = createLogger('RetryHandler');

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMaxMs: number;
  retryableErrors: string[];
  circuitBreakerThreshold: number;
  circuitBreakerResetMs: number;
}

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerInfo {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  successCount: number;
}

export interface RetryAttempt {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  error: Error;
  timestamp: number;
  willRetry: boolean;
}

export class RetryHandler implements Middleware {
  name = 'retry-handler';
  order = 20;

  private config: RetryConfig;
  private circuitBreakers: Map<string, CircuitBreakerInfo> = new Map();
  private retryHistory: Array<{
    requestId: string;
    provider: string;
    attempts: RetryAttempt[];
    totalDelayMs: number;
    timestamp: number;
  }> = [];
  private maxHistorySize: number = 500;
  private retryCallbacks: Array<(attempt: RetryAttempt) => void> = [];

  constructor(config?: Partial<RetryConfig>) {
    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      baseDelayMs: config?.baseDelayMs ?? 1000,
      maxDelayMs: config?.maxDelayMs ?? 30000,
      backoffMultiplier: config?.backoffMultiplier ?? 2,
      jitterMaxMs: config?.jitterMaxMs ?? 500,
      retryableErrors: config?.retryableErrors ?? [
        'rate_limit',
        'timeout',
        'connection_error',
        'server_error',
        'overloaded',
        '529',
        '503',
        '502',
        '429',
      ],
      circuitBreakerThreshold: config?.circuitBreakerThreshold ?? 5,
      circuitBreakerResetMs: config?.circuitBreakerResetMs ?? 60000,
    };
  }

  async beforeRequest(context: MiddlewareContext): Promise<MiddlewareContext> {
    const provider = context.request.provider;
    const breaker = this.getCircuitBreaker(provider);

    if (breaker.state === 'open') {
      if (Date.now() >= breaker.nextAttemptTime) {
        breaker.state = 'half-open';
        logger.info('Circuit breaker half-open', { provider });
      } else {
        logger.warn('Circuit breaker open, rejecting request', {
          provider,
          nextAttempt: new Date(breaker.nextAttemptTime).toISOString(),
        });
        context.aborted = true;
        context.abortReason = `Circuit breaker open for provider ${provider}`;
        context.metadata.circuitBreakerState = 'open';
        return context;
      }
    }

    context.retries = context.retries ?? 0;
    context.metadata.circuitBreakerState = breaker.state;
    return context;
  }

  async afterResponse(context: MiddlewareContext): Promise<MiddlewareContext> {
    if (!context.response) return context;

    const provider = context.request.provider;
    const breaker = this.getCircuitBreaker(provider);

    if (breaker.state === 'half-open') {
      breaker.state = 'closed';
      breaker.failureCount = 0;
      breaker.successCount++;
      logger.info('Circuit breaker closed after successful half-open', { provider });
    } else {
      breaker.successCount++;
    }

    return context;
  }

  async onError(context: MiddlewareContext, error: Error): Promise<MiddlewareContext> {
    const provider = context.request.provider;
    const breaker = this.getCircuitBreaker(provider);

    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();

    if (breaker.state === 'half-open') {
      breaker.state = 'open';
      breaker.nextAttemptTime = Date.now() + this.config.circuitBreakerResetMs;
      logger.warn('Circuit breaker reopened after half-open failure', { provider });
      context.aborted = true;
      context.abortReason = `Circuit breaker reopened for provider ${provider}`;
      return context;
    }

    if (breaker.failureCount >= this.config.circuitBreakerThreshold) {
      breaker.state = 'open';
      breaker.nextAttemptTime = Date.now() + this.config.circuitBreakerResetMs;
      logger.error('Circuit breaker opened due to failures', {
        provider,
        failureCount: breaker.failureCount,
      });
      context.aborted = true;
      context.abortReason = `Circuit breaker opened for provider ${provider} after ${breaker.failureCount} failures`;
      return context;
    }

    const isRetryable = this.isRetryableError(error);
    const currentRetries = context.retries ?? 0;

    if (isRetryable && currentRetries < this.config.maxRetries) {
      const delayMs = this.calculateBackoff(currentRetries);
      const attempt: RetryAttempt = {
        attempt: currentRetries + 1,
        maxAttempts: this.config.maxRetries,
        delayMs,
        error,
        timestamp: Date.now(),
        willRetry: true,
      };

      this.notifyRetry(attempt);
      context.retries = currentRetries + 1;
      context.metadata.retryAttempt = attempt;
      context.metadata.retryDelayMs = delayMs;

      logger.info('Will retry request', {
        requestId: context.request.id,
        attempt: currentRetries + 1,
        maxAttempts: this.config.maxRetries,
        delayMs,
        error: error.message,
      });
    } else {
      const attempt: RetryAttempt = {
        attempt: currentRetries + 1,
        maxAttempts: this.config.maxRetries,
        delayMs: 0,
        error,
        timestamp: Date.now(),
        willRetry: false,
      };
      context.metadata.retryAttempt = attempt;

      if (!isRetryable) {
        logger.error('Non-retryable error', {
          requestId: context.request.id,
          error: error.message,
        });
      } else {
        logger.error('Max retries exceeded', {
          requestId: context.request.id,
          attempts: currentRetries + 1,
        });
      }
    }

    return context;
  }

  async retry<T>(
    fn: () => Promise<T>,
    requestId: string = 'unknown',
  ): Promise<T> {
    let lastError: Error = new Error('No attempts made');
    const attempts: RetryAttempt[] = [];

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await fn();
        if (attempt > 0) {
          logger.info('Retry succeeded', { requestId, attempt });
        }
        return result;
      } catch (error) {
        lastError = error as Error;
        const isRetryable = this.isRetryableError(lastError);

        if (!isRetryable || attempt >= this.config.maxRetries) {
          const retryAttempt: RetryAttempt = {
            attempt: attempt + 1,
            maxAttempts: this.config.maxRetries + 1,
            delayMs: 0,
            error: lastError,
            timestamp: Date.now(),
            willRetry: false,
          };
          attempts.push(retryAttempt);
          break;
        }

        const delayMs = this.calculateBackoff(attempt);
        const retryAttempt: RetryAttempt = {
          attempt: attempt + 1,
          maxAttempts: this.config.maxRetries + 1,
          delayMs,
          error: lastError,
          timestamp: Date.now(),
          willRetry: true,
        };
        attempts.push(retryAttempt);
        this.notifyRetry(retryAttempt);

        logger.info('Retrying after error', {
          requestId,
          attempt: attempt + 1,
          delayMs,
          error: lastError.message,
        });

        await this.sleep(delayMs);
      }
    }

    this.recordHistory(requestId, 'unknown', attempts);
    throw lastError;
  }

  backoff(attempt: number): number {
    return this.calculateBackoff(attempt);
  }

  exponential(attempt: number): number {
    const delay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt);
    return Math.min(delay, this.config.maxDelayMs);
  }

  jitter(delayMs: number): number {
    const jitter = Math.random() * this.config.jitterMaxMs;
    return delayMs + jitter;
  }

  circuitBreaker(provider: string): CircuitBreakerInfo {
    return this.getCircuitBreaker(provider);
  }

  resetCircuitBreaker(provider: string): void {
    this.circuitBreakers.delete(provider);
    logger.info('Circuit breaker reset', { provider });
  }

  getAllCircuitBreakers(): Record<string, CircuitBreakerInfo> {
    const result: Record<string, CircuitBreakerInfo> = {};
    for (const [key, value] of this.circuitBreakers) {
      result[key] = { ...value };
    }
    return result;
  }

  onRetry(callback: (attempt: RetryAttempt) => void): void {
    this.retryCallbacks.push(callback);
  }

  getRetryHistory(limit: number = 50): typeof this.retryHistory {
    return this.retryHistory.slice(-limit);
  }

  getConfig(): RetryConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  private calculateBackoff(attempt: number): number {
    const exponentialDelay = this.exponential(attempt);
    const jitteredDelay = this.jitter(exponentialDelay);
    return Math.min(jitteredDelay, this.config.maxDelayMs);
  }

  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return this.config.retryableErrors.some(
      (retryable) => message.includes(retryable.toLowerCase()),
    );
  }

  private getCircuitBreaker(provider: string): CircuitBreakerInfo {
    if (!this.circuitBreakers.has(provider)) {
      this.circuitBreakers.set(provider, {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
        successCount: 0,
      });
    }
    return this.circuitBreakers.get(provider)!;
  }

  private notifyRetry(attempt: RetryAttempt): void {
    for (const callback of this.retryCallbacks) {
      try {
        callback(attempt);
      } catch (error) {
        logger.error('Retry callback error', { error: (error as Error).message });
      }
    }
  }

  private recordHistory(
    requestId: string,
    provider: string,
    attempts: RetryAttempt[],
  ): void {
    this.retryHistory.push({
      requestId,
      provider,
      attempts,
      totalDelayMs: attempts.reduce((sum, a) => sum + a.delayMs, 0),
      timestamp: Date.now(),
    });
    if (this.retryHistory.length > this.maxHistorySize) {
      this.retryHistory = this.retryHistory.slice(-this.maxHistorySize);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
