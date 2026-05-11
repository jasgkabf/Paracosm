import type { MemoryEntry, MemoryQuery as MemQuery, MemoryType } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';
import { MemoryIndexer } from './memory-indexer.js';

const logger = createLogger('MemoryQuery');

export class MemoryQuery {
  private indexer: MemoryIndexer;

  constructor(indexer: MemoryIndexer) {
    this.indexer = indexer;
  }

  search(entries: MemoryEntry[], query: string, options?: { type?: MemoryType; minImportance?: number; limit?: number }): MemoryEntry[] {
    let results = entries;
    if (options?.type) {
      results = results.filter((e) => e.type === options.type);
    }
    if (options?.minImportance !== undefined) {
      results = results.filter((e) => (e.importance ?? 0) >= options.minImportance!);
    }
    const matchingIds = new Set(this.indexer.search(query));
    const fuzzyIds = new Set(this.indexer.fuzzySearch(query));
    const allIds = new Set([...matchingIds, ...fuzzyIds]);
    results = results.filter((e) => allIds.has(e.id));
    results.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }
    return results;
  }

  findByKey(entries: MemoryEntry[], key: string): MemoryEntry | undefined {
    return entries.find((e) => e.id === key || e.content.includes(key));
  }

  findByType(entries: MemoryEntry[], type: MemoryType): MemoryEntry[] {
    return entries.filter((e) => e.type === type);
  }

  findByDateRange(entries: MemoryEntry[], start: Date, end: Date): MemoryEntry[] {
    return entries.filter((e) => e.createdAt >= start && e.createdAt <= end);
  }

  findMostAccessed(entries: MemoryEntry[], limit: number = 10): MemoryEntry[] {
    return [...entries]
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);
  }

  findMostImportant(entries: MemoryEntry[], limit: number = 10): MemoryEntry[] {
    return [...entries]
      .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
      .slice(0, limit);
  }

  findRecent(entries: MemoryEntry[], limit: number = 10): MemoryEntry[] {
    return [...entries]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}
