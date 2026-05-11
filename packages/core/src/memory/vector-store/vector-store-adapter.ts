import { createLogger } from '@paracosm/shared';

const logger = createLogger('VectorStoreAdapter');

export interface VectorEntry {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

export class VectorStoreAdapter {
  protected entries: Map<string, VectorEntry> = new Map();
  protected dimensions: number;

  constructor(dimensions: number = 128) {
    this.dimensions = dimensions;
  }

  add(id: string, vector: number[], metadata?: Record<string, unknown>): void {
    this.entries.set(id, { id, vector, metadata: metadata ?? {} });
  }

  remove(id: string): boolean {
    return this.entries.delete(id);
  }

  search(queryVector: number[], limit: number = 10, threshold?: number): VectorSearchResult[] {
    const results: VectorSearchResult[] = [];
    for (const entry of this.entries.values()) {
      const score = this.cosineSimilarity(queryVector, entry.vector);
      if (threshold === undefined || score >= threshold) {
        results.push({ id: entry.id, score, metadata: entry.metadata });
      }
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  get(id: string): VectorEntry | undefined {
    return this.entries.get(id);
  }

  protected cosineSimilarity(a: number[], b: number[]): number {
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
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}
