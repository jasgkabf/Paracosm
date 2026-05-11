import { EntityGraph } from './entity-graph.js';
import type { GraphStatsResult } from './types.js';

export class GraphStats {
  private graph: EntityGraph;

  constructor(graph: EntityGraph) {
    this.graph = graph;
  }

  compute(): GraphStatsResult {
    const entities = Array.from(this.graph.getAllEntities().values());
    const relations = Array.from(this.graph.getAllRelations().values());
    const entitiesByType: Record<string, number> = {};
    const relationsByType: Record<string, number> = {};
    const degreeMap: Map<string, number> = new Map();

    for (const entity of entities) {
      entitiesByType[entity.type] = (entitiesByType[entity.type] ?? 0) + 1;
      degreeMap.set(entity.id, 0);
    }

    for (const relation of relations) {
      relationsByType[relation.type] = (relationsByType[relation.type] ?? 0) + 1;
      degreeMap.set(relation.sourceId, (degreeMap.get(relation.sourceId) ?? 0) + 1);
      degreeMap.set(relation.targetId, (degreeMap.get(relation.targetId) ?? 0) + 1);
    }

    const degrees = Array.from(degreeMap.values());
    const totalEntities = entities.length;
    const totalRelations = relations.length;
    const averageConnectivity = degrees.length > 0 ? degrees.reduce((a, b) => a + b, 0) / degrees.length : 0;
    const maxConnectivity = degrees.length > 0 ? Math.max(...degrees) : 0;
    const minConnectivity = degrees.length > 0 ? Math.min(...degrees) : 0;
    const orphanEntities = degrees.filter((d) => d === 0).length;

    const sccs = this.computeStronglyConnectedComponents();
    const diameter = this.computeDiameter();
    const maxPossibleEdges = totalEntities * (totalEntities - 1);
    const density = maxPossibleEdges > 0 ? totalRelations / maxPossibleEdges : 0;

    return {
      totalEntities,
      totalRelations,
      entitiesByType,
      relationsByType,
      averageConnectivity,
      maxConnectivity,
      minConnectivity,
      orphanEntities,
      stronglyConnectedComponents: sccs,
      diameter,
      density,
    };
  }

  private computeStronglyConnectedComponents(): number {
    const entities = Array.from(this.graph.getAllEntities().keys());
    const visited = new Set<string>();
    const finishOrder: string[] = [];
    const reverseAdjacency = new Map<string, string[]>();

    for (const [id] of this.graph.getAllEntities()) {
      reverseAdjacency.set(id, []);
    }
    for (const relation of this.graph.getAllRelations().values()) {
      const list = reverseAdjacency.get(relation.targetId) ?? [];
      list.push(relation.sourceId);
      reverseAdjacency.set(relation.targetId, list);
    }

    const dfs1 = (node: string) => {
      visited.add(node);
      const neighbors = this.graph.getRelatedEntities(node, 'outgoing');
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.id)) {
          dfs1(neighbor.id);
        }
      }
      finishOrder.push(node);
    };

    for (const entity of entities) {
      if (!visited.has(entity)) {
        dfs1(entity);
      }
    }

    visited.clear();
    let sccCount = 0;

    const dfs2 = (node: string) => {
      visited.add(node);
      const predecessors = reverseAdjacency.get(node) ?? [];
      for (const pred of predecessors) {
        if (!visited.has(pred)) {
          dfs2(pred);
        }
      }
    };

    for (let i = finishOrder.length - 1; i >= 0; i--) {
      if (!visited.has(finishOrder[i])) {
        dfs2(finishOrder[i]);
        sccCount++;
      }
    }

    return sccCount;
  }

  private computeDiameter(): number {
    const entities = Array.from(this.graph.getAllEntities().keys());
    let maxDist = 0;
    const sampleSize = Math.min(entities.length, 20);
    const sample = entities.slice(0, sampleSize);

    for (const source of sample) {
      for (const target of entities) {
        if (source === target) continue;
        const path = this.graph.shortestPath(source, target);
        if (path && path.length > maxDist) {
          maxDist = path.length;
        }
      }
    }
    return maxDist;
  }

  getEntityDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};
    for (const entity of this.graph.getAllEntities().values()) {
      distribution[entity.type] = (distribution[entity.type] ?? 0) + 1;
    }
    return distribution;
  }

  getRelationDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};
    for (const relation of this.graph.getAllRelations().values()) {
      distribution[relation.type] = (distribution[relation.type] ?? 0) + 1;
    }
    return distribution;
  }

  getTopConnectedEntities(limit: number = 10): Array<{ id: string; name: string; degree: number }> {
    const results: Array<{ id: string; name: string; degree: number }> = [];
    for (const [id, entity] of this.graph.getAllEntities()) {
      const degree = this.graph.getRelatedEntities(id, 'both').length;
      results.push({ id, name: entity.name, degree });
    }
    results.sort((a, b) => b.degree - a.degree);
    return results.slice(0, limit);
  }
}
