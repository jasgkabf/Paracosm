import { EventEmitter } from "node:events";
import { Result, ok, err } from "@paracosm/shared";
import { LLMError } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";

const logger = new Logger("RateLimiter");

interface TokenBucketState {
  tokens: number;
  maxTokens: number;
  refillRate: number;
  lastRefill: number;
}

interface SlidingWindowEntry {
  timestamp: number;
  count: number;
}

export class RateLimiter extends EventEmitter {
  private tokenBuckets: Map<string, TokenBucketState> = new Map();
  private slidingWindows: Map<string, SlidingWindowEntry[]> = new Map();
  private maxWindowEntries: number = 10000;
  private waitQueue: Map<string, Array<{ resolve: () => void; reject: (reason: unknown) => void }>> = new Map();

  check(key: string, maxRequests: number, windowMs: number): Result<boolean, Error> {
    const allowed = this.slidingWindowCheck(key, maxRequests, windowMs);
    if (!allowed) {
      this.emit("rate_limited", { key, maxRequests, windowMs });
    }
    return ok(allowed);
  }

  async wait(key: string, maxRequests: number, windowMs: number): Promise<void> {
    const allowed = this.slidingWindowCheck(key, maxRequests, windowMs);
    if (allowed) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      if (!this.waitQueue.has(key)) {
        this.waitQueue.set(key, []);
      }
      this.waitQueue.get(key)!.push({ resolve, reject });

      const waitTime = this.calculateWaitTime(key, maxRequests, windowMs);
      if (waitTime > 0) {
        setTimeout(() => {
          this.processWaitQueue(key, maxRequests, windowMs);
        }, waitTime);
      }
    });
  }

  tokenBucket(key: string, maxTokens: number, refillRatePerSecond: number): { allowed: boolean; remaining: number; retryAfterMs: number } {
    let bucket = this.tokenBuckets.get(key);
    if (!bucket) {
      bucket = {
        tokens: maxTokens,
        maxTokens,
        refillRate: refillRatePerSecond,
        lastRefill: Date.now(),
      };
      this.tokenBuckets.set(key, bucket);
    }

    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + elapsed * bucket.refillRate);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
    }

    const retryAfterMs = Math.ceil(((1 - bucket.tokens) / bucket.refillRate) * 1000);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  slidingWindow(key: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    const cutoff = now - windowMs;

    if (!this.slidingWindows.has(key)) {
      this.slidingWindows.set(key, []);
    }

    const entries = this.slidingWindows.get(key)!;
    const validEntries = entries.filter((e) => e.timestamp >= cutoff);
    this.slidingWindows.set(key, validEntries);

    const currentCount = validEntries.reduce((sum, e) => sum + e.count, 0);

    if (currentCount < maxRequests) {
      validEntries.push({ timestamp: now, count: 1 });
      return { allowed: true, remaining: maxRequests - currentCount - 1, retryAfterMs: 0 };
    }

    const oldestEntry = validEntries[0];
    const retryAfterMs = oldestEntry ? Math.max(0, oldestEntry.timestamp + windowMs - now) : windowMs;
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  private slidingWindowCheck(key: string, maxRequests: number, windowMs: number): boolean {
    const result = this.slidingWindow(key, maxRequests, windowMs);
    return result.allowed;
  }

  private calculateWaitTime(key: string, maxRequests: number, windowMs: number): number {
    const entries = this.slidingWindows.get(key);
    if (!entries || entries.length === 0) {
      return 0;
    }

    const now = Date.now();
    const cutoff = now - windowMs;
    const validEntries = entries.filter((e) => e.timestamp >= cutoff);
    if (validEntries.length === 0) {
      return 0;
    }

    const currentCount = validEntries.reduce((sum, e) => sum + e.count, 0);
    if (currentCount < maxRequests) {
      return 0;
    }

    const oldest = validEntries[0];
    return Math.max(0, oldest.timestamp + windowMs - now);
  }

  private processWaitQueue(key: string, maxRequests: number, windowMs: number): void {
    const queue = this.waitQueue.get(key);
    if (!queue || queue.length === 0) {
      return;
    }

    const allowed = this.slidingWindowCheck(key, maxRequests, windowMs);
    if (allowed) {
      const next = queue.shift();
      if (next) {
        next.resolve();
      }
    } else {
      const waitTime = this.calculateWaitTime(key, maxRequests, windowMs);
      if (waitTime > 0) {
        setTimeout(() => {
          this.processWaitQueue(key, maxRequests, windowMs);
        }, Math.min(waitTime, 1000));
      }
    }
  }

  reset(key?: string): void {
    if (key) {
      this.tokenBuckets.delete(key);
      this.slidingWindows.delete(key);
    } else {
      this.tokenBuckets.clear();
      this.slidingWindows.clear();
    }
  }

  getStatus(key: string): { tokenBucket: TokenBucketState | undefined; slidingWindowCount: number } {
    const bucket = this.tokenBuckets.get(key);
    const entries = this.slidingWindows.get(key) ?? [];
    return {
      tokenBucket: bucket ? { ...bucket } : undefined,
      slidingWindowCount: entries.length,
    };
  }
}
