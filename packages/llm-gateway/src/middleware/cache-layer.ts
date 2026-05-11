import { createLogger, generateId } from '@paracosm/shared';
import type { Middleware, MiddlewareContext } from './middleware-pipeline.js';

const logger = createLogger('CacheLayer');

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: number;
  accessedAt: number;
  ttlMs: number;
  hits: number;
  tags: string[];
  provider: string;
  model: string;
}

export interface SemanticCacheEntry extends CacheEntry<string> {
  embedding: number[];
  similarityThreshold: number;
  originalPrompt: string;
}

export interface CacheConfig {
  maxEntries: number;
  defaultTtlMs: number;
  semanticEnabled: boolean;
  semanticThreshold: number;
  semanticVectorSize: number;
  exactEnabled: boolean;
  lruEnabled: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  totalEntries: number;
  memoryUsageBytes: number;
}

export class CacheLayer implements Middleware {
  name = 'cache-layer';
  order = 15;

  private config: CacheConfig;
  private exactCache: Map<string, CacheEntry> = new Map();
  private semanticCache: SemanticCacheEntry[] = [];
  private lruOrder: string[] = [];
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    evictions: 0,
    totalEntries: 0,
    memoryUsageBytes: 0,
  };
  private tagIndex: Map<string, Set<string>> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxEntries: config?.maxEntries ?? 1000,
      defaultTtlMs: config?.defaultTtlMs ?? 300000,
      semanticEnabled: config?.semanticEnabled ?? true,
      semanticThreshold: config?.semanticThreshold ?? 0.92,
      semanticVectorSize: config?.semanticVectorSize ?? 128,
      exactEnabled: config?.exactEnabled ?? true,
      lruEnabled: config?.lruEnabled ?? true,
    };

    this.cleanupInterval = setInterval(() => this.evictExpired(), 60000);
  }

  async beforeRequest(context: MiddlewareContext): Promise<MiddlewareContext> {
    const cacheKey = this.buildCacheKey(context.request.prompt, context.request.model, context.request.provider);

    const cached = this.get(cacheKey);
    if (cached !== undefined) {
      logger.info('Cache hit', { key: cacheKey, model: context.request.model });
      context.metadata.cacheHit = true;
      context.metadata.cacheKey = cacheKey;
      context.metadata.cachedResponse = cached;
      return context;
    }

    const semanticResult = this.semanticLookup(context.request.prompt, context.request.model);
    if (semanticResult !== undefined) {
      logger.info('Semantic cache hit', { model: context.request.model });
      context.metadata.semanticCacheHit = true;
      context.metadata.cachedResponse = semanticResult;
      return context;
    }

    context.metadata.cacheHit = false;
    context.metadata.cacheKey = cacheKey;
    this.stats.misses++;
    this.updateHitRate();
    return context;
  }

  async afterResponse(context: MiddlewareContext): Promise<MiddlewareContext> {
    if (!context.response) return context;
    if (context.metadata.cacheHit || context.metadata.semanticCacheHit) return context;

    const cacheKey = context.metadata.cacheKey as string;
    if (!cacheKey) return context;

    this.set(cacheKey, context.response.content, {
      provider: context.response.provider,
      model: context.response.model,
      ttlMs: this.config.defaultTtlMs,
      tags: this.extractTags(context.request.prompt),
    });

    if (this.config.semanticEnabled) {
      this.semanticSet(
        context.request.prompt,
        context.response.content,
        context.request.model,
        context.response.provider,
      );
    }

    return context;
  }

  get(key: string): unknown | undefined {
    if (!this.config.exactEnabled) return undefined;

    const entry = this.exactCache.get(key);
    if (!entry) return undefined;

    if (this.isExpired(entry)) {
      this.exactCache.delete(key);
      this.removeFromLru(key);
      return undefined;
    }

    entry.accessedAt = Date.now();
    entry.hits++;
    this.stats.hits++;
    this.updateLru(key);
    this.updateHitRate();
    return entry.value;
  }

  set(key: string, value: unknown, options?: {
    provider?: string;
    model?: string;
    ttlMs?: number;
    tags?: string[];
  }): void {
    if (!this.config.exactEnabled) return;

    if (this.exactCache.size >= this.config.maxEntries) {
      this.evictLru();
    }

    const entry: CacheEntry = {
      key,
      value,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      ttlMs: options?.ttlMs ?? this.config.defaultTtlMs,
      hits: 0,
      tags: options?.tags ?? [],
      provider: options?.provider ?? 'unknown',
      model: options?.model ?? 'unknown',
    };

    this.exactCache.set(key, entry);
    this.addToLru(key);

    if (options?.tags) {
      for (const tag of options.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(key);
      }
    }

    this.updateStats();
  }

  invalidate(key: string): boolean {
    const entry = this.exactCache.get(key);
    if (!entry) return false;

    for (const tag of entry.tags) {
      const tagSet = this.tagIndex.get(tag);
      if (tagSet) {
        tagSet.delete(key);
        if (tagSet.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    this.exactCache.delete(key);
    this.removeFromLru(key);
    this.updateStats();
    return true;
  }

  invalidateByTag(tag: string): number {
    const keys = this.tagIndex.get(tag);
    if (!keys) return 0;

    let count = 0;
    for (const key of keys) {
      if (this.invalidate(key)) count++;
    }
    this.tagIndex.delete(tag);
    return count;
  }

  invalidateByProvider(provider: string): number {
    let count = 0;
    for (const [key, entry] of this.exactCache) {
      if (entry.provider === provider) {
        if (this.invalidate(key)) count++;
      }
    }
    return count;
  }

  invalidateByModel(model: string): number {
    let count = 0;
    for (const [key, entry] of this.exactCache) {
      if (entry.model === model) {
        if (this.invalidate(key)) count++;
      }
    }
    return count;
  }

  invalidateAll(): void {
    this.exactCache.clear();
    this.semanticCache = [];
    this.lruOrder = [];
    this.tagIndex.clear();
    this.updateStats();
  }

  semanticLookup(prompt: string, model: string): string | undefined {
    if (!this.config.semanticEnabled) return undefined;

    const promptVector = this.simpleHashVector(prompt);
    let bestMatch: SemanticCacheEntry | null = null;
    let bestSimilarity = 0;

    for (const entry of this.semanticCache) {
      if (entry.model !== model) continue;
      if (this.isExpired(entry)) continue;

      const similarity = this.cosineSimilarity(promptVector, entry.embedding);
      if (similarity > bestSimilarity && similarity >= this.config.semanticThreshold) {
        bestSimilarity = similarity;
        bestMatch = entry;
      }
    }

    if (bestMatch) {
      bestMatch.accessedAt = Date.now();
      bestMatch.hits++;
      this.stats.hits++;
      this.updateHitRate();
      return bestMatch.value;
    }

    return undefined;
  }

  semanticSet(
    prompt: string,
    response: string,
    model: string,
    provider: string,
  ): void {
    if (!this.config.semanticEnabled) return;

    const embedding = this.simpleHashVector(prompt);
    const key = `semantic:${generateId()}`;

    const entry: SemanticCacheEntry = {
      key,
      value: response,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      ttlMs: this.config.defaultTtlMs,
      hits: 0,
      tags: [],
      provider,
      model,
      embedding,
      similarityThreshold: this.config.semanticThreshold,
      originalPrompt: prompt,
    };

    this.semanticCache.push(entry);

    if (this.semanticCache.length > this.config.maxEntries / 2) {
      this.semanticCache.sort((a, b) => a.accessedAt - b.accessedAt);
      this.semanticCache = this.semanticCache.slice(
        Math.floor(this.semanticCache.length / 4),
      );
      this.stats.evictions += Math.floor(this.semanticCache.length / 4);
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  getSize(): number {
    return this.exactCache.size + this.semanticCache.length;
  }

  getEntries(): CacheEntry[] {
    return Array.from(this.exactCache.values());
  }

  getSemanticEntries(): SemanticCacheEntry[] {
    return [...this.semanticCache];
  }

  getTags(): string[] {
    return Array.from(this.tagIndex.keys());
  }

  setTTL(key: string, ttlMs: number): boolean {
    const entry = this.exactCache.get(key);
    if (!entry) return false;
    entry.ttlMs = ttlMs;
    return true;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.invalidateAll();
  }

  private buildCacheKey(prompt: string, model: string, provider: string): string {
    const normalizedPrompt = prompt.trim().toLowerCase();
    return `${provider}:${model}:${this.hashString(normalizedPrompt)}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  private simpleHashVector(text: string): number[] {
    const vector = new Array(this.config.semanticVectorSize).fill(0);
    const normalized = text.toLowerCase().trim();
    const words = normalized.split(/\s+/);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(j);
        hash |= 0;
      }
      const idx = Math.abs(hash) % this.config.semanticVectorSize;
      vector[idx] += 1 + (i * 0.01);
    }

    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }

    return vector;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;
    return dotProduct / denominator;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.createdAt > entry.ttlMs;
  }

  private extractTags(prompt: string): string[] {
    const tags: string[] = [];
    const words = prompt.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor', 'not', 'so', 'if', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them', 'their', 'what', 'which', 'who', 'whom']);
    for (const word of words) {
      if (word.length > 3 && !stopWords.has(word)) {
        tags.push(word);
      }
    }
    return tags.slice(0, 10);
  }

  private addToLru(key: string): void {
    if (!this.config.lruEnabled) return;
    this.lruOrder.push(key);
  }

  private removeFromLru(key: string): void {
    if (!this.config.lruEnabled) return;
    const idx = this.lruOrder.indexOf(key);
    if (idx !== -1) {
      this.lruOrder.splice(idx, 1);
    }
  }

  private updateLru(key: string): void {
    if (!this.config.lruEnabled) return;
    this.removeFromLru(key);
    this.lruOrder.push(key);
  }

  private evictLru(): void {
    if (!this.config.lruEnabled || this.lruOrder.length === 0) return;
    const oldestKey = this.lruOrder[0];
    this.invalidate(oldestKey);
    this.stats.evictions++;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.exactCache) {
      if (now - entry.createdAt > entry.ttlMs) {
        this.invalidate(key);
        this.stats.evictions++;
      }
    }

    this.semanticCache = this.semanticCache.filter(
      (entry) => now - entry.createdAt <= entry.ttlMs,
    );

    this.updateStats();
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private updateStats(): void {
    this.stats.totalEntries = this.exactCache.size + this.semanticCache.length;
    let memoryBytes = 0;
    for (const entry of this.exactCache.values()) {
      memoryBytes += JSON.stringify(entry.value).length * 2;
    }
    for (const entry of this.semanticCache) {
      memoryBytes += entry.value.length * 2;
      memoryBytes += entry.embedding.length * 8;
    }
    this.stats.memoryUsageBytes = memoryBytes;
  }
}
