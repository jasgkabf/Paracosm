import { BaseVectorStoreAdapter } from "./vector-store-adapter.js";
import type { VectorSearchResult, VectorStoreStats } from "../types.js";
import { cosineSimilarity } from "./vector-utils.js";

interface HNSWNode {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
  neighbors: Map<number, Set<string>>;
  level: number;
  createdAt: string;
  updatedAt: string;
}

export class InMemoryVectorStore extends BaseVectorStoreAdapter {
  private nodes: Map<string, HNSWNode>;
  private entryPoint: string | null;
  private maxLevel: number;
  private maxConnectionsPerLayer: number;
  private maxConnectionsLayer0: number;
  private efConstruction: number;
  private efSearch: number;
  private levelMultiplier: number;

  constructor(
    dimension: number = 128,
    maxConnectionsPerLayer: number = 16,
    maxConnectionsLayer0: number = 32,
    efConstruction: number = 200,
    efSearch: number = 50
  ) {
    super(dimension);
    this.nodes = new Map();
    this.entryPoint = null;
    this.maxLevel = -1;
    this.maxConnectionsPerLayer = maxConnectionsPerLayer;
    this.maxConnectionsLayer0 = maxConnectionsLayer0;
    this.efConstruction = efConstruction;
    this.efSearch = efSearch;
    this.levelMultiplier = 1 / Math.log(maxConnectionsPerLayer);
  }

  upsert(id: string, vector: number[], metadata: Record<string, unknown>): void {
    this.validateDimension(vector);
    const now = new Date().toISOString();

    const existing = this.nodes.get(id);
    if (existing) {
      existing.vector = vector;
      existing.metadata = metadata;
      existing.updatedAt = now;
      this.vectors.set(id, { vector, metadata, createdAt: existing.createdAt, updatedAt: now });
      return;
    }

    const level = this.randomLevel();
    const node: HNSWNode = {
      id,
      vector,
      metadata,
      neighbors: new Map(),
      level,
      createdAt: now,
      updatedAt: now,
    };

    for (let l = 0; l <= level; l++) {
      node.neighbors.set(l, new Set());
    }

    this.nodes.set(id, node);
    this.vectors.set(id, { vector, metadata, createdAt: now, updatedAt: now });

    if (this.entryPoint === null) {
      this.entryPoint = id;
      this.maxLevel = level;
      return;
    }

    this.insertNode(node);

    if (level > this.maxLevel) {
      this.maxLevel = level;
      this.entryPoint = id;
    }
  }

  query(vector: number[], topK: number): VectorSearchResult[] {
    this.validateDimension(vector);

    if (this.entryPoint === null || this.nodes.size === 0) {
      return [];
    }

    if (this.nodes.size <= topK * 2) {
      return this.bruteForceSearch(vector, topK);
    }

    let currentId = this.entryPoint;

    for (let level = this.maxLevel; level > 0; level--) {
      let changed = true;
      while (changed) {
        changed = false;
        const currentNode = this.nodes.get(currentId);
        if (!currentNode) break;

        const neighbors = currentNode.neighbors.get(level);
        if (!neighbors) break;

        const currentDist = cosineSimilarity(vector, currentNode.vector);

        for (const neighborId of neighbors) {
          const neighbor = this.nodes.get(neighborId);
          if (!neighbor) continue;

          const neighborDist = cosineSimilarity(vector, neighbor.vector);
          if (neighborDist > currentDist) {
            currentId = neighborId;
            changed = true;
          }
        }
      }
    }

    const candidates = this.searchLayer(vector, currentId, 0, this.efSearch);

    candidates.sort((a, b) => b.similarity - a.similarity);

    return candidates.slice(0, topK).map((c) => ({
      id: c.id,
      score: c.similarity,
      vector: this.nodes.get(c.id)!.vector,
      metadata: this.nodes.get(c.id)!.metadata,
    }));
  }

  delete(id: string): void {
    const node = this.nodes.get(id);
    if (!node) return;

    for (let level = 0; level <= node.level; level++) {
      const neighbors = node.neighbors.get(level);
      if (neighbors) {
        for (const neighborId of neighbors) {
          const neighbor = this.nodes.get(neighborId);
          if (neighbor) {
            const neighborConnections = neighbor.neighbors.get(level);
            if (neighborConnections) {
              neighborConnections.delete(id);
            }
          }
        }
      }
    }

    this.nodes.delete(id);
    this.vectors.delete(id);

    if (this.entryPoint === id) {
      if (this.nodes.size > 0) {
        const firstNode = this.nodes.values().next().value!;
        this.entryPoint = firstNode.id;
        this.maxLevel = firstNode.level;
      } else {
        this.entryPoint = null;
        this.maxLevel = -1;
      }
    }
  }

  stats(): VectorStoreStats {
    let totalIndexSize = 0;
    for (const node of this.nodes.values()) {
      for (const [, neighbors] of node.neighbors) {
        totalIndexSize += neighbors.size;
      }
    }

    return {
      vectorCount: this.nodes.size,
      dimension: this.dimension,
      indexSize: totalIndexSize,
      memoryUsageBytes: this.estimateMemoryUsage(),
      lastUpdated: new Date().toISOString(),
    };
  }

  private bruteForceSearch(vector: number[], topK: number): VectorSearchResult[] {
    const results: Array<{ id: string; similarity: number }> = [];

    for (const [id, node] of this.nodes) {
      const similarity = cosineSimilarity(vector, node.vector);
      results.push({ id, similarity });
    }

    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, topK).map((r) => ({
      id: r.id,
      score: r.similarity,
      vector: this.nodes.get(r.id)!.vector,
      metadata: this.nodes.get(r.id)!.metadata,
    }));
  }

  private insertNode(node: HNSWNode): void {
    const entryId = this.entryPoint!;

    let currentId = entryId;

    for (let level = this.maxLevel; level > node.level; level--) {
      let changed = true;
      while (changed) {
        changed = false;
        const currentNode = this.nodes.get(currentId);
        if (!currentNode) break;

        const neighbors = currentNode.neighbors.get(level);
        if (!neighbors) break;

        const currentDist = cosineSimilarity(node.vector, currentNode.vector);

        for (const neighborId of neighbors) {
          const neighbor = this.nodes.get(neighborId);
          if (!neighbor) continue;

          const neighborDist = cosineSimilarity(node.vector, neighbor.vector);
          if (neighborDist > currentDist) {
            currentId = neighborId;
            changed = true;
          }
        }
      }
    }

    for (let level = Math.min(node.level, this.maxLevel); level >= 0; level--) {
      const candidates = this.searchLayer(node.vector, currentId, level, this.efConstruction);

      const maxConn = level === 0 ? this.maxConnectionsLayer0 : this.maxConnectionsPerLayer;
      const selected = candidates.slice(0, maxConn);

      for (const candidate of selected) {
        node.neighbors.get(level)!.add(candidate.id);

        const candidateNode = this.nodes.get(candidate.id);
        if (candidateNode) {
          const candidateNeighbors = candidateNode.neighbors.get(level);
          if (candidateNeighbors) {
            candidateNeighbors.add(node.id);

            if (candidateNeighbors.size > maxConn) {
              const pruned = this.selectNeighbors(candidateNode.vector, candidateNeighbors, maxConn, level);
              candidateNode.neighbors.set(level, pruned);
            }
          }
        }
      }

      if (selected.length > 0) {
        currentId = selected[0].id;
      }
    }
  }

  private searchLayer(
    queryVector: number[],
    entryId: string,
    level: number,
    ef: number
  ): Array<{ id: string; similarity: number }> {
    const visited = new Set<string>();
    const candidates: Array<{ id: string; similarity: number }> = [];
    const results: Array<{ id: string; similarity: number }> = [];

    const entryNode = this.nodes.get(entryId);
    if (!entryNode) return [];

    const entrySimilarity = cosineSimilarity(queryVector, entryNode.vector);
    visited.add(entryId);
    candidates.push({ id: entryId, similarity: entrySimilarity });
    results.push({ id: entryId, similarity: entrySimilarity });

    while (candidates.length > 0) {
      candidates.sort((a, b) => b.similarity - a.similarity);
      const current = candidates.shift()!;

      results.sort((a, b) => b.similarity - a.similarity);
      const worstResult = results[results.length - 1];

      if (current.similarity < worstResult.similarity && results.length >= ef) {
        break;
      }

      const currentNode = this.nodes.get(current.id);
      if (!currentNode) continue;

      const neighbors = currentNode.neighbors.get(level);
      if (!neighbors) continue;

      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode) continue;

        const neighborSimilarity = cosineSimilarity(queryVector, neighborNode.vector);

        results.sort((a, b) => b.similarity - a.similarity);
        const currentWorst = results.length > 0 ? results[results.length - 1].similarity : -Infinity;

        if (neighborSimilarity > currentWorst || results.length < ef) {
          candidates.push({ id: neighborId, similarity: neighborSimilarity });
          results.push({ id: neighborId, similarity: neighborSimilarity });

          if (results.length > ef) {
            results.sort((a, b) => b.similarity - a.similarity);
            results.pop();
          }
        }
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results;
  }

  private selectNeighbors(
    vector: number[],
    neighborIds: Set<string>,
    maxConn: number,
    _level: number
  ): Set<string> {
    if (neighborIds.size <= maxConn) {
      return new Set(neighborIds);
    }

    const scored: Array<{ id: string; similarity: number }> = [];
    for (const id of neighborIds) {
      const node = this.nodes.get(id);
      if (node) {
        const similarity = cosineSimilarity(vector, node.vector);
        scored.push({ id, similarity });
      }
    }

    scored.sort((a, b) => b.similarity - a.similarity);

    const selected = new Set<string>();
    for (let i = 0; i < Math.min(maxConn, scored.length); i++) {
      selected.add(scored[i].id);
    }

    return selected;
  }

  private randomLevel(): number {
    let level = 0;
    while (Math.random() < Math.exp(-1 / this.levelMultiplier) && level < 16) {
      level += 1;
    }
    return level;
  }
}
