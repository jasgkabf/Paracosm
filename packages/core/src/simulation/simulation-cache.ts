import type { SimulationResult, SimulationConfig } from '@paracosm/shared';
import { generateId, createLogger } from '@paracosm/shared';

const logger = createLogger('SimulationCache');

interface CacheEntry {
  key: string;
  result: SimulationResult;
  createdAt: number;
  accessCount: number;
  lastAccessedAt: number;
}

export class SimulationCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 100, ttlMs: number = 300000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  generateKey(config: SimulationConfig, initialState: Record<string, unknown>): string {
    const configStr = JSON.stringify(config);
    const stateStr = JSON.stringify(initialState, Object.keys(initialState).sort());
    let hash = 0;
    for (let i = 0; i < configStr.length; i++) {
      const char = configStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    for (let i = 0; i < stateStr.length; i++) {
      const char = stateStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `sim_${Math.abs(hash).toString(36)}`;
  }

  get(key: string): SimulationResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    const now = Date.now();
    if (now - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    entry.accessCount++;
    entry.lastAccessedAt = now;
    return entry.result;
  }

  set(key: string, result: SimulationResult): void {
    if (this.cache.size >= this.maxSize) {
      this.evict();
    }
    const now = Date.now();
    this.cache.set(key, {
      key,
      result,
      createdAt: now,
      accessCount: 1,
      lastAccessedAt: now,
    });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  invalidate(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; maxSize: number; hitRate: number; avgAge: number } {
    const now = Date.now();
    let totalAge = 0;
    for (const entry of this.cache.values()) {
      totalAge += now - entry.createdAt;
    }
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0,
      avgAge: this.cache.size > 0 ? totalAge / this.cache.size : 0,
    };
  }

  private evict(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;
    for (const [key, entry] of this.cache) {
      if (entry.lastAccessedAt < oldestAccess) {
        oldestAccess = entry.lastAccessedAt;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt > this.ttlMs) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }
}
