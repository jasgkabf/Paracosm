import { BaseVectorStoreAdapter } from "./vector-store-adapter.js";
import type { VectorSearchResult, VectorStoreStats } from "../types.js";
import { cosineSimilarity, normalize } from "./vector-utils.js";

interface SQLiteRow {
  id: string;
  vector: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

interface SQLiteVecRow {
  id: string;
  vector: string;
  distance: number;
}

export class SQLiteVectorStore extends BaseVectorStoreAdapter {
  private db: Map<string, { vector: number[]; metadata: Record<string, unknown>; createdAt: string; updatedAt: string }>;
  private partitions: Map<number, Set<string>>;
  private partitionCount: number;
  private filePath: string | null;
  private dirty: boolean;
  private lastSavedAt: number;

  constructor(dimension: number = 128, filePath: string | null = null, partitionCount: number = 10) {
    super(dimension);
    this.db = new Map();
    this.partitions = new Map();
    this.partitionCount = partitionCount;
    this.filePath = filePath;
    this.dirty = false;
    this.lastSavedAt = 0;

    for (let i = 0; i < partitionCount; i++) {
      this.partitions.set(i, new Set());
    }
  }

  upsert(id: string, vector: number[], metadata: Record<string, unknown>): void {
    this.validateDimension(vector);
    const now = new Date().toISOString();

    const existing = this.db.get(id);
    if (existing) {
      const oldPartition = this.getPartition(existing.vector);
      this.partitions.get(oldPartition)?.delete(id);

      existing.vector = vector;
      existing.metadata = metadata;
      existing.updatedAt = now;

      const newPartition = this.getPartition(vector);
      this.partitions.get(newPartition)?.add(id);
    } else {
      this.db.set(id, { vector, metadata, createdAt: now, updatedAt: now });
      this.vectors.set(id, { vector, metadata, createdAt: now, updatedAt: now });

      const partition = this.getPartition(vector);
      this.partitions.get(partition)?.add(id);
    }

    this.dirty = true;
  }

  query(vector: number[], topK: number): VectorSearchResult[] {
    this.validateDimension(vector);

    if (this.db.size === 0) {
      return [];
    }

    const candidatePartitions = this.getCandidatePartitions(vector, Math.max(3, Math.ceil(this.partitionCount * 0.3)));
    const candidateIds = new Set<string>();

    for (const partitionIdx of candidatePartitions) {
      const partitionIds = this.partitions.get(partitionIdx);
      if (partitionIds) {
        for (const id of partitionIds) {
          candidateIds.add(id);
        }
      }
    }

    if (candidateIds.size < topK) {
      for (const id of this.db.keys()) {
        candidateIds.add(id);
      }
    }

    const scored: Array<{ id: string; score: number }> = [];
    for (const id of candidateIds) {
      const entry = this.db.get(id);
      if (!entry) continue;

      const similarity = cosineSimilarity(vector, entry.vector);
      scored.push({ id, score: similarity });
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map((s) => {
      const entry = this.db.get(s.id)!;
      return {
        id: s.id,
        score: s.score,
        vector: entry.vector,
        metadata: entry.metadata,
      };
    });
  }

  delete(id: string): void {
    const entry = this.db.get(id);
    if (!entry) return;

    const partition = this.getPartition(entry.vector);
    this.partitions.get(partition)?.delete(id);

    this.db.delete(id);
    this.vectors.delete(id);
    this.dirty = true;
  }

  stats(): VectorStoreStats {
    return {
      vectorCount: this.db.size,
      dimension: this.dimension,
      indexSize: this.partitionCount,
      memoryUsageBytes: this.estimateMemoryUsage(),
      lastUpdated: new Date().toISOString(),
    };
  }

  async saveToDisk(): Promise<void> {
    if (!this.filePath) return;

    const { writeFile, mkdir } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    const { existsSync } = await import("node:fs");

    const data = {
      dimension: this.dimension,
      partitionCount: this.partitionCount,
      entries: Array.from(this.db.entries()).map(([id, entry]) => ({
        id,
        vector: entry.vector,
        metadata: entry.metadata,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      })),
    };

    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(this.filePath, JSON.stringify(data), "utf8");
    this.dirty = false;
    this.lastSavedAt = Date.now();
  }

  async loadFromDisk(): Promise<void> {
    if (!this.filePath) return;

    const { readFile } = await import("node:fs/promises");
    const { existsSync } = await import("node:fs");

    if (!existsSync(this.filePath)) return;

    const data = await readFile(this.filePath, "utf8");
    const parsed = JSON.parse(data);

    this.db.clear();
    this.vectors.clear();
    for (const [, partition] of this.partitions) {
      partition.clear();
    }

    if (parsed.dimension) {
      this.dimension = parsed.dimension;
    }

    for (const entry of parsed.entries) {
      this.db.set(entry.id, {
        vector: entry.vector,
        metadata: entry.metadata,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      });
      this.vectors.set(entry.id, {
        vector: entry.vector,
        metadata: entry.metadata,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      });

      const partition = this.getPartition(entry.vector);
      this.partitions.get(partition)?.add(entry.id);
    }

    this.dirty = false;
  }

  isDirty(): boolean {
    return this.dirty;
  }

  getLastSavedAt(): number {
    return this.lastSavedAt;
  }

  getPartitionCount(): number {
    return this.partitionCount;
  }

  getPartitionSizes(): Record<number, number> {
    const sizes: Record<number, number> = {};
    for (const [idx, ids] of this.partitions) {
      sizes[idx] = ids.size;
    }
    return sizes;
  }

  rebuildPartitions(): void {
    for (const [, ids] of this.partitions) {
      ids.clear();
    }

    for (const [id, entry] of this.db) {
      const partition = this.getPartition(entry.vector);
      this.partitions.get(partition)?.add(id);
    }
  }

  private getPartition(vector: number[]): number {
    let hash = 0;
    for (let i = 0; i < Math.min(vector.length, 16); i++) {
      hash = ((hash << 5) - hash) + Math.round(vector[i] * 10000);
      hash = hash & hash;
    }
    return Math.abs(hash) % this.partitionCount;
  }

  private getCandidatePartitions(queryVector: number[], count: number): number[] {
    const partitionScores: Array<{ partition: number; score: number }> = [];

    for (let p = 0; p < this.partitionCount; p++) {
      const partitionIds = this.partitions.get(p);
      if (!partitionIds || partitionIds.size === 0) continue;

      let score = 0;
      let sampleCount = 0;
      for (const id of partitionIds) {
        const entry = this.db.get(id);
        if (entry) {
          score += cosineSimilarity(queryVector, entry.vector);
          sampleCount += 1;
        }
        if (sampleCount >= 5) break;
      }

      partitionScores.push({
        partition: p,
        score: sampleCount > 0 ? score / sampleCount : 0,
      });
    }

    partitionScores.sort((a, b) => b.score - a.score);
    return partitionScores.slice(0, count).map((ps) => ps.partition);
  }
}
