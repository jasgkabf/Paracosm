import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { Result, ok, err } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";

const logger = new Logger("CacheLayer");

interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  accessedAt: number;
  ttlMs: number;
  hits: number;
  semanticHash?: string;
}

interface LRUNode<T> {
  key: string;
  entry: CacheEntry<T>;
  prev: LRUNode<T> | null;
  next: LRUNode<T> | null;
}

export class CacheLayer<T = unknown> extends EventEmitter {
  private exactCache: Map<string, CacheEntry<T>> = new Map();
  private semanticCache: Map<string, CacheEntry<T>> = new Map();
  private lruHead: LRUNode<T> | null = null;
  private lruTail: LRUNode<T> | null = null;
  private lruMap: Map<string, LRUNode<T>> = new Map();
  private maxSize: number;
  private defaultTtlMs: number;
  private stats = { hits: 0, misses: 0, evictions: 0, sets: 0 };

  constructor(maxSize: number = 1000, defaultTtlMs: number = 300000) {
    super();
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): Result<T, string> {
    const entry = this.exactCache.get(key);
    if (!entry) {
      this.stats.misses++;
      return err("Cache miss");
    }

    if (this.isExpired(entry)) {
      this.exactCache.delete(key);
      this.removeFromLRU(key);
      this.stats.misses++;
      return err("Cache expired");
    }

    entry.accessedAt = Date.now();
    entry.hits++;
    this.stats.hits++;
    this.moveToFront(key);
    this.emit("hit", { key, hits: entry.hits });
    return ok(entry.value);
  }

  set(key: string, value: T, ttlMs?: number): Result<void, string> {
    if (this.exactCache.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      ttlMs: ttlMs ?? this.defaultTtlMs,
      hits: 0,
    };

    this.exactCache.set(key, entry);
    this.addToLRU(key, entry);
    this.stats.sets++;
    this.emit("set", { key, ttlMs: entry.ttlMs });
    return ok(undefined);
  }

  invalidate(key: string): boolean {
    const deleted = this.exactCache.delete(key);
    this.removeFromLRU(key);
    if (deleted) {
      this.emit("invalidated", { key });
    }
    return deleted;
  }

  invalidatePattern(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern);
    for (const key of this.exactCache.keys()) {
      if (regex.test(key)) {
        this.exactCache.delete(key);
        this.removeFromLRU(key);
        count++;
      }
    }
    return count;
  }

  semanticGet(text: string, threshold: number = 0.95): Result<T, string> {
    const hash = this.computeSemanticHash(text);
    for (const [key, entry] of this.semanticCache.entries()) {
      if (this.isExpired(entry)) {
        this.semanticCache.delete(key);
        continue;
      }
      const similarity = this.computeSimilarity(hash, entry.semanticHash ?? "");
      if (similarity >= threshold) {
        entry.accessedAt = Date.now();
        entry.hits++;
        this.stats.hits++;
        this.emit("semantic_hit", { key, similarity, hits: entry.hits });
        return ok(entry.value);
      }
    }
    this.stats.misses++;
    return err("Semantic cache miss");
  }

  semanticSet(text: string, value: T, ttlMs?: number): Result<void, string> {
    if (this.semanticCache.size >= this.maxSize) {
      const oldest = this.semanticCache.keys().next().value;
      if (oldest) {
        this.semanticCache.delete(oldest);
      }
    }

    const hash = this.computeSemanticHash(text);
    const entry: CacheEntry<T> = {
      key: `semantic_${hash}`,
      value,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      ttlMs: ttlMs ?? this.defaultTtlMs,
      hits: 0,
      semanticHash: hash,
    };

    this.semanticCache.set(entry.key, entry);
    this.stats.sets++;
    return ok(undefined);
  }

  getStats(): { hits: number; misses: number; evictions: number; sets: number; size: number; hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.exactCache.size + this.semanticCache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  clear(): void {
    this.exactCache.clear();
    this.semanticCache.clear();
    this.lruHead = null;
    this.lruTail = null;
    this.lruMap.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0, sets: 0 };
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.createdAt > entry.ttlMs;
  }

  private evictLRU(): void {
    if (!this.lruTail) {
      return;
    }
    const key = this.lruTail.key;
    this.exactCache.delete(key);
    this.removeFromLRU(key);
    this.stats.evictions++;
    this.emit("evicted", { key });
  }

  private addToLRU(key: string, entry: CacheEntry<T>): void {
    const node: LRUNode<T> = { key, entry, prev: null, next: this.lruHead };
    if (this.lruHead) {
      this.lruHead.prev = node;
    }
    this.lruHead = node;
    if (!this.lruTail) {
      this.lruTail = node;
    }
    this.lruMap.set(key, node);
  }

  private removeFromLRU(key: string): void {
    const node = this.lruMap.get(key);
    if (!node) return;

    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.lruHead = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.lruTail = node.prev;
    }

    this.lruMap.delete(key);
  }

  private moveToFront(key: string): void {
    const node = this.lruMap.get(key);
    if (!node || node === this.lruHead) return;

    this.removeFromLRU(key);
    this.addToLRU(key, node.entry);
  }

  private computeSemanticHash(text: string): string {
    const normalized = text.toLowerCase().trim().replace(/\s+/g, " ");
    return createHash("sha256").update(normalized).digest("hex");
  }

  private computeSimilarity(hash1: string, hash2: string): number {
    if (hash1 === hash2) return 1;
    let matches = 0;
    const len = Math.min(hash1.length, hash2.length);
    for (let i = 0; i < len; i++) {
      if (hash1[i] === hash2[i]) matches++;
    }
    return matches / Math.max(hash1.length, hash2.length);
  }
}
