import { createLogger } from '@paracosm/shared';
import type { Middleware, MiddlewareContext } from './middleware-pipeline.js';

const logger = createLogger('RateLimiter');

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  maxTokensPerMinute: number;
  maxConcurrentRequests: number;
}

export interface TokenBucketState {
  tokens: number;
  maxTokens: number;
  refillRate: number;
  lastRefill: number;
}

export interface SlidingWindowEntry {
  timestamp: number;
  tokens: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
  remainingRequests: number;
  remainingTokens: number;
  resetAt: number;
}

export class RateLimiter implements Middleware {
  name = 'rate-limiter';
  order = 5;

  private config: RateLimitConfig;
  private tokenBucket: TokenBucketState;
  private slidingWindow: Map<string, SlidingWindowEntry[]> = new Map();
  private activeRequests: number = 0;
  private requestQueue: Array<{
    resolve: (result: RateLimitResult) => void;
    timestamp: number;
  }> = [];
  private maxQueueSize: number = 100;
  private providerLimits: Map<string, RateLimitConfig> = new Map();
  private providerBuckets: Map<string, TokenBucketState> = new Map();

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      maxRequests: config?.maxRequests ?? 60,
      windowMs: config?.windowMs ?? 60000,
      maxTokensPerMinute: config?.maxTokensPerMinute ?? 150000,
      maxConcurrentRequests: config?.maxConcurrentRequests ?? 10,
    };

    this.tokenBucket = {
      tokens: this.config.maxTokensPerMinute,
      maxTokens: this.config.maxTokensPerMinute,
      refillRate: this.config.maxTokensPerMinute / 60,
      lastRefill: Date.now(),
    };
  }

  async beforeRequest(context: MiddlewareContext): Promise<MiddlewareContext> {
    const provider = context.request.provider;
    const estimatedTokens = this.estimateRequestTokens(context.request.prompt);

    const result = this.check(provider, estimatedTokens);

    if (!result.allowed) {
      logger.warn('Rate limit exceeded', {
        provider,
        retryAfterMs: result.retryAfterMs,
        remainingRequests: result.remainingRequests,
      });
      context.aborted = true;
      context.abortReason = `Rate limit exceeded. Retry after ${result.retryAfterMs}ms`;
      context.metadata.rateLimitResult = result;
      return context;
    }

    this.activeRequests++;
    context.metadata.rateLimitRemaining = result.remainingRequests;
    context.metadata.rateLimitResetAt = result.resetAt;
    return context;
  }

  async afterResponse(context: MiddlewareContext): Promise<MiddlewareContext> {
    this.activeRequests--;
    this.processQueue();
    return context;
  }

  async onError(context: MiddlewareContext, _error: Error): Promise<MiddlewareContext> {
    this.activeRequests--;
    this.processQueue();
    return context;
  }

  check(provider: string, estimatedTokens: number = 0): RateLimitResult {
    this.refillTokenBucket();

    const providerConfig = this.providerLimits.get(provider) ?? this.config;
    const providerBucket = this.providerBuckets.get(provider) ?? this.tokenBucket;

    const windowKey = `${provider}:${Math.floor(Date.now() / providerConfig.windowMs)}`;
    const entries = this.slidingWindow.get(windowKey) ?? [];

    const windowStart = Date.now() - providerConfig.windowMs;
    const validEntries = entries.filter((e) => e.timestamp > windowStart);

    const requestCount = validEntries.length;
    const tokensInWindow = validEntries.reduce((sum, e) => sum + e.tokens, 0);

    const remainingRequests = Math.max(0, providerConfig.maxRequests - requestCount);
    const remainingTokens = Math.max(0, providerBucket.tokens - estimatedTokens);

    if (requestCount >= providerConfig.maxRequests) {
      const oldestEntry = validEntries[0];
      const retryAfterMs = oldestEntry
        ? oldestEntry.timestamp + providerConfig.windowMs - Date.now()
        : providerConfig.windowMs;
      return {
        allowed: false,
        retryAfterMs: Math.max(0, retryAfterMs),
        remainingRequests: 0,
        remainingTokens,
        resetAt: oldestEntry ? oldestEntry.timestamp + providerConfig.windowMs : Date.now() + providerConfig.windowMs,
      };
    }

    if (this.activeRequests >= providerConfig.maxConcurrentRequests) {
      return {
        allowed: false,
        retryAfterMs: 1000,
        remainingRequests,
        remainingTokens,
        resetAt: Date.now() + 1000,
      };
    }

    if (estimatedTokens > 0 && providerBucket.tokens < estimatedTokens) {
      const deficit = estimatedTokens - providerBucket.tokens;
      const waitMs = Math.ceil(deficit / providerBucket.refillRate) * 1000;
      return {
        allowed: false,
        retryAfterMs: waitMs,
        remainingRequests,
        remainingTokens: 0,
        resetAt: Date.now() + waitMs,
      };
    }

    if (tokensInWindow + estimatedTokens > providerConfig.maxTokensPerMinute) {
      const oldestEntry = validEntries[0];
      const retryAfterMs = oldestEntry
        ? oldestEntry.timestamp + providerConfig.windowMs - Date.now()
        : providerConfig.windowMs;
      return {
        allowed: false,
        retryAfterMs: Math.max(0, retryAfterMs),
        remainingRequests,
        remainingTokens: 0,
        resetAt: oldestEntry ? oldestEntry.timestamp + providerConfig.windowMs : Date.now() + providerConfig.windowMs,
      };
    }

    this.recordRequest(provider, estimatedTokens);
    if (estimatedTokens > 0) {
      providerBucket.tokens -= estimatedTokens;
    }

    return {
      allowed: true,
      retryAfterMs: 0,
      remainingRequests: remainingRequests - 1,
      remainingTokens: Math.max(0, remainingTokens - estimatedTokens),
      resetAt: Date.now() + providerConfig.windowMs,
    };
  }

  async wait(provider: string, estimatedTokens: number = 0): Promise<RateLimitResult> {
    const result = this.check(provider, estimatedTokens);
    if (result.allowed) return result;

    return new Promise<RateLimitResult>((resolve) => {
      if (this.requestQueue.length >= this.maxQueueSize) {
        resolve({
          allowed: false,
          retryAfterMs: -1,
          remainingRequests: 0,
          remainingTokens: 0,
          resetAt: 0,
        });
        return;
      }
      this.requestQueue.push({ resolve, timestamp: Date.now() });
    });
  }

  configureTokenBucket(config: { maxTokens: number; refillRatePerSecond: number }): void {
    this.tokenBucket = {
      tokens: config.maxTokens,
      maxTokens: config.maxTokens,
      refillRate: config.refillRatePerSecond,
      lastRefill: Date.now(),
    };
  }

  configureSlidingWindow(config: { maxRequests: number; windowMs: number }): void {
    this.config.maxRequests = config.maxRequests;
    this.config.windowMs = config.windowMs;
  }

  setProviderLimit(provider: string, config: Partial<RateLimitConfig>): void {
    const existing = this.providerLimits.get(provider) ?? { ...this.config };
    this.providerLimits.set(provider, { ...existing, ...config });

    if (!this.providerBuckets.has(provider)) {
      this.providerBuckets.set(provider, {
        tokens: config.maxTokensPerMinute ?? this.config.maxTokensPerMinute,
        maxTokens: config.maxTokensPerMinute ?? this.config.maxTokensPerMinute,
        refillRate: (config.maxTokensPerMinute ?? this.config.maxTokensPerMinute) / 60,
        lastRefill: Date.now(),
      });
    }
  }

  getActiveRequests(): number {
    return this.activeRequests;
  }

  getQueueSize(): number {
    return this.requestQueue.length;
  }

  getTokenBucketState(): TokenBucketState {
    this.refillTokenBucket();
    return { ...this.tokenBucket };
  }

  getStats(): {
    activeRequests: number;
    queueSize: number;
    tokenBucketTokens: number;
    providerStats: Record<string, { activeRequests: number; bucketTokens: number }>;
  } {
    this.refillTokenBucket();
    const providerStats: Record<string, { activeRequests: number; bucketTokens: number }> = {};
    for (const [provider, bucket] of this.providerBuckets) {
      providerStats[provider] = {
        activeRequests: 0,
        bucketTokens: bucket.tokens,
      };
    }
    return {
      activeRequests: this.activeRequests,
      queueSize: this.requestQueue.length,
      tokenBucketTokens: this.tokenBucket.tokens,
      providerStats,
    };
  }

  reset(): void {
    this.tokenBucket.tokens = this.tokenBucket.maxTokens;
    this.tokenBucket.lastRefill = Date.now();
    this.slidingWindow.clear();
    this.activeRequests = 0;
    this.requestQueue = [];
    for (const bucket of this.providerBuckets.values()) {
      bucket.tokens = bucket.maxTokens;
      bucket.lastRefill = Date.now();
    }
  }

  private refillTokenBucket(): void {
    const now = Date.now();
    const elapsed = (now - this.tokenBucket.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.tokenBucket.refillRate;
    this.tokenBucket.tokens = Math.min(
      this.tokenBucket.maxTokens,
      this.tokenBucket.tokens + tokensToAdd,
    );
    this.tokenBucket.lastRefill = now;

    for (const bucket of this.providerBuckets.values()) {
      const bucketElapsed = (now - bucket.lastRefill) / 1000;
      const bucketTokensToAdd = bucketElapsed * bucket.refillRate;
      bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + bucketTokensToAdd);
      bucket.lastRefill = now;
    }
  }

  private recordRequest(provider: string, tokens: number): void {
    const windowKey = `${provider}:${Math.floor(Date.now() / this.config.windowMs)}`;
    const entries = this.slidingWindow.get(windowKey) ?? [];
    entries.push({ timestamp: Date.now(), tokens });
    this.slidingWindow.set(windowKey, entries);

    const windowStart = Date.now() - this.config.windowMs * 2;
    for (const [key, keyEntries] of this.slidingWindow) {
      const filtered = keyEntries.filter((e) => e.timestamp > windowStart);
      if (filtered.length === 0) {
        this.slidingWindow.delete(key);
      } else {
        this.slidingWindow.set(key, filtered);
      }
    }
  }

  private processQueue(): void {
    while (this.requestQueue.length > 0) {
      const next = this.requestQueue[0];
      if (Date.now() - next.timestamp > 30000) {
        this.requestQueue.shift();
        next.resolve({
          allowed: false,
          retryAfterMs: -1,
          remainingRequests: 0,
          remainingTokens: 0,
          resetAt: 0,
        });
        continue;
      }

      const result = this.check('default', 0);
      if (result.allowed) {
        this.requestQueue.shift();
        next.resolve(result);
      } else {
        break;
      }
    }
  }

  private estimateRequestTokens(prompt: string): number {
    return Math.ceil(prompt.length / 4);
  }
}
