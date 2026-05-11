import type { SimulationResult } from "@paracosm/shared";

interface CacheEntry {
  key: string;
  result: SimulationResult;
  createdAt: number;
  expiresAt: number;
  accessCount: number;
  sizeBytes: number;
  compressed: boolean;
  lastAccessedAt: number;
}

interface CacheStats {
  hitCount: number;
  missCount: number;
  evictionCount: number;
  size: number;
  totalSizeBytes: number;
  hitRate: number;
}

export class SimulationCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttlMs: number;
  private stats: { hits: number; misses: number; evictions: number };
  private accessOrder: string[];

  constructor(options?: { maxSize?: number; ttlMs?: number }) {
    this.cache = new Map();
    this.maxSize = options?.maxSize ?? 100;
    this.ttlMs = options?.ttlMs ?? 300000;
    this.stats = { hits: 0, misses: 0, evictions: 0 };
    this.accessOrder = [];
  }

  store(key: string, result: SimulationResult): void {
    const sizeBytes = this.estimateSize(result);

    if (this.cache.size >= this.maxSize) {
      this.evict();
    }

    const now = Date.now();
    const entry: CacheEntry = {
      key,
      result,
      createdAt: now,
      expiresAt: now + this.ttlMs,
      accessCount: 0,
      sizeBytes,
      compressed: false,
      lastAccessedAt: now,
    };

    if (sizeBytes > 10000) {
      entry.compressed = true;
      entry.sizeBytes = Math.floor(sizeBytes * 0.6);
    }

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
  }

  retrieve(key: string): SimulationResult | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.misses++;
      return null;
    }

    entry.accessCount++;
    entry.lastAccessedAt = Date.now();
    this.updateAccessOrder(key);
    this.stats.hits++;

    return entry.result;
  }

  invalidate(pattern: string | RegExp): void {
    const regex = typeof pattern === "string" ? new RegExp(pattern.replace(/\*/g, ".*")) : pattern;

    const keysToRemove: string[] = [];
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    }
  }

  evict(): void {
    if (this.cache.size === 0) return;

    const expiredKeys: string[] = [];
    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    if (expiredKeys.length > 0) {
      for (const key of expiredKeys) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        this.stats.evictions++;
      }
      return;
    }

    if (this.accessOrder.length > 0) {
      const lruKey = this.accessOrder[0];
      this.cache.delete(lruKey);
      this.removeFromAccessOrder(lruKey);
      this.stats.evictions++;
      return;
    }

    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }
  }

  generateKey(params: {
    action?: string;
    snapshotId?: string;
    config?: Record<string, unknown>;
    seed?: number;
  }): string {
    const parts: string[] = [];

    if (params.action) parts.push(`a:${params.action}`);
    if (params.snapshotId) parts.push(`s:${params.snapshotId}`);
    if (params.seed !== undefined) parts.push(`seed:${params.seed}`);
    if (params.config) {
      const configStr = this.stableStringify(params.config);
      const configHash = this.hashString(configStr);
      parts.push(`c:${configHash}`);
    }

    return parts.join("|");
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    let totalSizeBytes = 0;
    for (const entry of this.cache.values()) {
      totalSizeBytes += entry.sizeBytes;
    }

    return {
      hitCount: this.stats.hits,
      missCount: this.stats.misses,
      evictionCount: this.stats.evictions,
      size: this.cache.size,
      totalSizeBytes,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return false;
    }
    return true;
  }

  getSize(): number {
    return this.cache.size;
  }

  getRemainingTtl(key: string): number {
    const entry = this.cache.get(key);
    if (!entry) return 0;
    const remaining = entry.expiresAt - Date.now();
    return Math.max(0, remaining);
  }

  setTtl(key: string, ttlMs: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    entry.expiresAt = Date.now() + ttlMs;
    return true;
  }

  compress(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry || entry.compressed) return false;

    entry.compressed = true;
    entry.sizeBytes = Math.floor(entry.sizeBytes * 0.6);
    return true;
  }

  decompress(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry || !entry.compressed) return false;

    entry.compressed = false;
    entry.sizeBytes = Math.floor(entry.sizeBytes / 0.6);
    return true;
  }

  pruneExpired(): number {
    let pruned = 0;
    const keysToRemove: string[] = [];

    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      pruned++;
    }

    return pruned;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expiresAt;
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx >= 0) {
      this.accessOrder.splice(idx, 1);
    }
  }

  private estimateSize(result: SimulationResult): number {
    const jsonStr = JSON.stringify(result);
    return jsonStr.length * 2;
  }

  private stableStringify(obj: unknown): string {
    if (obj === null || typeof obj !== "object") {
      return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
      return "[" + obj.map((v) => this.stableStringify(v)).join(",") + "]";
    }

    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const pairs = keys.map((k) => JSON.stringify(k) + ":" + this.stableStringify((obj as Record<string, unknown>)[k]));
    return "{" + pairs.join(",") + "}";
  }

  private hashString(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return (hash >>> 0).toString(36);
  }
}
