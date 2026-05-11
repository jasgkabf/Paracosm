import type { EntityRecord, RelationRecord } from "./types.js";

export interface GraphStatsResult {
  entityCount: number;
  relationCount: number;
  density: number;
  avgDegree: number;
  maxDegree: number;
  minDegree: number;
  connectivity: number;
  clusteringCoefficient: number;
  entityTypeDistribution: Record<string, number>;
  relationTypeDistribution: Record<string, number>;
  componentCount: number;
  largestComponentSize: number;
  orphanCount: number;
}

export class GraphStats {
  static compute(
    entities: Map<string, EntityRecord>,
    relations: Map<string, RelationRecord>
  ): GraphStatsResult {
    const entityCount = entities.size;
    const relationCount = relations.size;

    const density = GraphStats.computeDensity(entityCount, relationCount);

    const degreeMap = GraphStats.computeDegrees(entities, relations);
    const degrees = Array.from(degreeMap.values());

    const avgDegree = degrees.length > 0 ? degrees.reduce((a, b) => a + b, 0) / degrees.length : 0;
    const maxDegree = degrees.length > 0 ? Math.max(...degrees) : 0;
    const minDegree = degrees.length > 0 ? Math.min(...degrees) : 0;

    const connectivity = GraphStats.computeConnectivity(entities, degreeMap);

    const clusteringCoefficient = GraphStats.computeClusteringCoefficient(entities, relations);

    const entityTypeDistribution = GraphStats.computeEntityTypeDistribution(entities);
    const relationTypeDistribution = GraphStats.computeRelationTypeDistribution(relations);

    const { componentCount, largestComponentSize } = GraphStats.computeComponents(entities, relations);

    const orphanCount = GraphStats.computeOrphanCount(entities, degreeMap);

    return {
      entityCount,
      relationCount,
      density,
      avgDegree,
      maxDegree,
      minDegree,
      connectivity,
      clusteringCoefficient,
      entityTypeDistribution,
      relationTypeDistribution,
      componentCount,
      largestComponentSize,
      orphanCount,
    };
  }

  static computeDensity(entityCount: number, relationCount: number): number {
    if (entityCount < 2) return 0;
    const maxEdges = entityCount * (entityCount - 1);
    return relationCount / maxEdges;
  }

  static computeDegrees(
    entities: Map<string, EntityRecord>,
    relations: Map<string, RelationRecord>
  ): Map<string, number> {
    const degrees = new Map<string, number>();

    for (const id of entities.keys()) {
      degrees.set(id, 0);
    }

    for (const relation of relations.values()) {
      degrees.set(relation.sourceId, (degrees.get(relation.sourceId) ?? 0) + 1);
      degrees.set(relation.targetId, (degrees.get(relation.targetId) ?? 0) + 1);
    }

    return degrees;
  }

  static computeConnectivity(
    entities: Map<string, EntityRecord>,
    degreeMap: Map<string, number>
  ): number {
    if (entities.size === 0) return 0;

    let connectedCount = 0;
    for (const [id] of entities) {
      const degree = degreeMap.get(id) ?? 0;
      if (degree > 0) {
        connectedCount++;
      }
    }

    return connectedCount / entities.size;
  }

  static computeClusteringCoefficient(
    entities: Map<string, EntityRecord>,
    relations: Map<string, RelationRecord>
  ): number {
    if (entities.size < 3) return 0;

    const adjacency = new Map<string, Set<string>>();
    for (const [id] of entities) {
      adjacency.set(id, new Set());
    }

    for (const relation of relations.values()) {
      adjacency.get(relation.sourceId)?.add(relation.targetId);
      if (relation.bidirectional) {
        adjacency.get(relation.targetId)?.add(relation.sourceId);
      }
    }

    let totalCoefficient = 0;
    let nodeCount = 0;

    for (const [nodeId, neighbors] of adjacency) {
      const neighborArr = Array.from(neighbors);
      const k = neighborArr.length;

      if (k < 2) continue;

      let triangles = 0;
      for (let i = 0; i < neighborArr.length; i++) {
        for (let j = i + 1; j < neighborArr.length; j++) {
          const neighborI = adjacency.get(neighborArr[i]);
          if (neighborI && neighborI.has(neighborArr[j])) {
            triangles++;
          }
        }
      }

      const possibleTriangles = (k * (k - 1)) / 2;
      totalCoefficient += triangles / possibleTriangles;
      nodeCount++;
    }

    return nodeCount > 0 ? totalCoefficient / nodeCount : 0;
  }

  static computeEntityTypeDistribution(
    entities: Map<string, EntityRecord>
  ): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const entity of entities.values()) {
      const type = entity.entityType;
      distribution[type] = (distribution[type] ?? 0) + 1;
    }

    return distribution;
  }

  static computeRelationTypeDistribution(
    relations: Map<string, RelationRecord>
  ): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const relation of relations.values()) {
      const type = relation.relationType;
      distribution[type] = (distribution[type] ?? 0) + 1;
    }

    return distribution;
  }

  static computeComponents(
    entities: Map<string, EntityRecord>,
    relations: Map<string, RelationRecord>
  ): { componentCount: number; largestComponentSize: number } {
    if (entities.size === 0) return { componentCount: 0, largestComponentSize: 0 };

    const adjacency = new Map<string, Set<string>>();
    for (const [id] of entities) {
      adjacency.set(id, new Set());
    }

    for (const relation of relations.values()) {
      adjacency.get(relation.sourceId)?.add(relation.targetId);
      adjacency.get(relation.targetId)?.add(relation.sourceId);
    }

    const visited = new Set<string>();
    let componentCount = 0;
    let largestComponentSize = 0;

    for (const [nodeId] of entities) {
      if (visited.has(nodeId)) continue;

      componentCount++;
      const componentSize = GraphStats.bfsComponentSize(nodeId, adjacency, visited);
      largestComponentSize = Math.max(largestComponentSize, componentSize);
    }

    return { componentCount, largestComponentSize };
  }

  static computeOrphanCount(
    entities: Map<string, EntityRecord>,
    degreeMap: Map<string, number>
  ): number {
    let orphanCount = 0;
    for (const [id] of entities) {
      const degree = degreeMap.get(id) ?? 0;
      if (degree === 0) {
        orphanCount++;
      }
    }
    return orphanCount;
  }

  private static bfsComponentSize(
    startId: string,
    adjacency: Map<string, Set<string>>,
    visited: Set<string>
  ): number {
    const queue: string[] = [startId];
    visited.add(startId);
    let size = 0;

    while (queue.length > 0) {
      const current = queue.shift()!;
      size++;

      const neighbors = adjacency.get(current);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }

    return size;
  }
}
