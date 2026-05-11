import type { MemoryEntry } from '@paracosm/shared';
import { VectorStoreAdapter, type VectorSearchResult } from './vector-store-adapter.js';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('MemoryVectorStore');

export class MemoryVectorStore extends VectorStoreAdapter {
  private entryMap: Map<string, string> = new Map();

  addEntry(entry: MemoryEntry, vector: number[]): void {
    this.add(entry.id, vector, {
      type: entry.type,
      importance: entry.importance,
      contentPreview: entry.content.substring(0, 100),
    });
    this.entryMap.set(entry.id, entry.id);
  }

  removeEntry(entryId: string): boolean {
    this.entryMap.delete(entryId);
    return this.remove(entryId);
  }

  searchByVector(vector: number[], limit?: number, threshold?: number): VectorSearchResult[] {
    return this.search(vector, limit, threshold);
  }

  getEntryIds(): string[] {
    return Array.from(this.entryMap.keys());
  }
}
