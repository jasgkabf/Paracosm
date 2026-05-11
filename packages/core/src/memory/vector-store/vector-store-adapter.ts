import type { Result } from "@paracosm/shared";
import type { VectorSearchResult, VectorStoreStats } from "../types.js";

export interface VectorStoreAdapter {
  upsert(id: string, vector: number[], metadata: Record<string, unknown>): void;
  query(vector: number[], topK: number): VectorSearchResult[];
  delete(id: string): void;
  stats(): VectorStoreStats;
}

export abstract class BaseVectorStoreAdapter implements VectorStoreAdapter {
  protected dimension: number;
  protected vectors: Map<string, { vector: number[]; metadata: Record<string, unknown>; createdAt: string; updatedAt: string }>;

  constructor(dimension: number = 128) {
    this.dimension = dimension;
    this.vectors = new Map();
  }

  abstract upsert(id: string, vector: number[], metadata: Record<string, unknown>): void;
  abstract query(vector: number[], topK: number): VectorSearchResult[];
  abstract delete(id: string): void;
  abstract stats(): VectorStoreStats;

  protected validateDimension(vector: number[]): void {
    if (vector.length !== this.dimension) {
      throw new Error(`Vector dimension mismatch: expected ${this.dimension}, got ${vector.length}`);
    }
  }

  protected computeCosineSimilarity(a: number[], b: number[]): number {
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

  protected estimateMemoryUsage(): number {
    let totalBytes = 0;
    for (const [, entry] of this.vectors) {
      totalBytes += entry.vector.length * 8;
      totalBytes += JSON.stringify(entry.metadata).length * 2;
    }
    return totalBytes;
  }

  getVector(id: string): number[] | null {
    const entry = this.vectors.get(id);
    return entry ? entry.vector : null;
  }

  getMetadata(id: string): Record<string, unknown> | null {
    const entry = this.vectors.get(id);
    return entry ? entry.metadata : null;
  }

  has(id: string): boolean {
    return this.vectors.has(id);
  }

  size(): number {
    return this.vectors.size;
  }

  clear(): void {
    this.vectors.clear();
  }

  getAllIds(): string[] {
    return Array.from(this.vectors.keys());
  }
}
