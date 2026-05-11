import type { MemoryEntry, MemoryType } from '@paracosm/shared';
import { generateId, ok, err, type Result, createLogger } from '@paracosm/shared';

const logger = createLogger('ShortTermMemory');

export class ShortTermMemory {
  private entries: Map<string, MemoryEntry> = new Map();
  private capacity: number;
  private ttlMs: number;
  private accessIndex: Map<string, number> = new Map();

  constructor(capacity: number = 100, ttlMs: number = 3600000) {
    this.capacity = capacity;
    this.ttlMs = ttlMs;
  }

  store(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'accessCount'> & { id?: string }): Result<MemoryEntry> {
    const id = entry.id ?? generateId();
    const now = new Date();
    const newEntry: MemoryEntry = {
      ...entry,
      id,
      createdAt: now,
      accessCount: 0,
    };
    if (this.entries.size >= this.capacity) {
      this.evictExpired();
      if (this.entries.size >= this.capacity) {
        this.evictLeastAccessed();
      }
    }
    this.entries.set(id, newEntry);
    this.accessIndex.set(id, 0);
    return ok(newEntry);
  }

  retrieve(id: string): MemoryEntry | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    if (this.isExpired(entry)) {
      this.entries.delete(id);
      this.accessIndex.delete(id);
      return undefined;
    }
    entry.accessCount++;
    entry.lastAccessedAt = new Date();
    this.accessIndex.set(id, (this.accessIndex.get(id) ?? 0) + 1);
    return entry;
  }

  remove(id: string): Result<boolean> {
    if (!this.entries.has(id)) return err(new Error(`Entry ${id} not found`));
    this.entries.delete(id);
    this.accessIndex.delete(id);
    return ok(true);
  }

  search(query: string, limit: number = 10): MemoryEntry[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.entries.values())
      .filter((e) => !this.isExpired(e))
      .filter((e) => e.content.toLowerCase().includes(lowerQuery) || e.id.toLowerCase().includes(lowerQuery))
      .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
      .slice(0, limit);
  }

  getAll(): MemoryEntry[] {
    return Array.from(this.entries.values()).filter((e) => !this.isExpired(e));
  }

  private isExpired(entry: MemoryEntry): boolean {
    const age = Date.now() - entry.createdAt.getTime();
    return age > this.ttlMs;
  }

  private evictExpired(): void {
    for (const [id, entry] of this.entries) {
      if (this.isExpired(entry)) {
        this.entries.delete(id);
        this.accessIndex.delete(id);
      }
    }
  }

  private evictLeastAccessed(): void {
    let leastId: string | null = null;
    let leastAccess = Infinity;
    for (const [id, count] of this.accessIndex) {
      if (count < leastAccess) {
        leastAccess = count;
        leastId = id;
      }
    }
    if (leastId) {
      this.entries.delete(leastId);
      this.accessIndex.delete(leastId);
    }
  }

  getSize(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
    this.accessIndex.clear();
  }
}
