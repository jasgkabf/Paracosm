import type { Entity, Relation, EntityType, RelationType } from '@paracosm/shared';
import type { GraphQueryOptions, SubgraphResult } from './types.js';
import { EntityGraph } from './entity-graph.js';

export class GraphQuery {
  private graph: EntityGraph;

  constructor(graph: EntityGraph) {
    this.graph = graph;
  }

  findEntities(options: GraphQueryOptions): Entity[] {
    let entities = this.graph.getAllEntities().values();
    let results = Array.from(entities);
    if (options.entityTypes && options.entityTypes.length > 0) {
      const typeSet = new Set(options.entityTypes);
      results = results.filter((e) => typeSet.has(e.type));
    }
    if (options.attributeFilters) {
      for (const [key, value] of Object.entries(options.attributeFilters)) {
        results = results.filter((e) => {
          const attrValue = e.attributes[key];
          if (typeof value === 'function') return value(attrValue);
          return attrValue === value;
        });
      }
    }
    if (options.relationTypes && options.relationTypes.length > 0) {
      const relTypeSet = new Set(options.relationTypes);
      results = results.filter((e) => {
        const outgoing = this.graph.queryByRelation(relTypeSet.values().next().value as RelationType, e.id);
        return outgoing.length > 0;
      });
    }
    if (options.offset) {
      results = results.slice(options.offset);
    }
    if (options.limit) {
      results = results.slice(0, options.limit);
    }
    return results;
  }

  findRelations(options: { sourceId?: string; targetId?: string; types?: RelationType[]; minStrength?: number }): Relation[] {
    let relations = Array.from(this.graph.getAllRelations().values());
    if (options.sourceId) {
      relations = relations.filter((r) => r.sourceId === options.sourceId);
    }
    if (options.targetId) {
      relations = relations.filter((r) => r.targetId === options.targetId);
    }
    if (options.types && options.types.length > 0) {
      const typeSet = new Set(options.types);
      relations = relations.filter((r) => typeSet.has(r.type));
    }
    if (options.minStrength !== undefined) {
      relations = relations.filter((r) => r.strength >= options.minStrength!);
    }
    return relations;
  }

  findPath(fromId: string, toId: string, options?: { relationTypes?: string[]; maxDepth?: number }) {
    return this.graph.shortestPath(fromId, toId, options);
  }

  getNeighborhood(entityId: string, depth: number = 1): SubgraphResult {
    const visited = new Set<string>();
    const entityIds: string[] = [entityId];
    visited.add(entityId);
    for (let d = 0; d < depth; d++) {
      const currentIds = [...entityIds];
      for (const id of currentIds) {
        const related = this.graph.getRelatedEntities(id, 'both');
        for (const entity of related) {
          if (!visited.has(entity.id)) {
            visited.add(entity.id);
            entityIds.push(entity.id);
          }
        }
      }
    }
    return this.graph.subgraph(entityIds);
  }

  getConnectedComponents(): string[][] {
    const visited = new Set<string>();
    const components: string[][] = [];
    const allEntities = Array.from(this.graph.getAllEntities().keys());
    for (const entityId of allEntities) {
      if (visited.has(entityId)) continue;
      const component: string[] = [];
      const queue = [entityId];
      visited.add(entityId);
      while (queue.length > 0) {
        const current = queue.shift()!;
        component.push(current);
        const neighbors = this.graph.getRelatedEntities(current, 'both');
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor.id)) {
            visited.add(neighbor.id);
            queue.push(neighbor.id);
          }
        }
      }
      components.push(component);
    }
    return components;
  }

  getDegree(entityId: string, direction: 'in' | 'out' | 'both' = 'both'): number {
    const dir = direction === 'in' ? 'incoming' : direction === 'out' ? 'outgoing' : 'both';
    return this.graph.getRelatedEntities(entityId, dir).length;
  }

  getCentrality(entityId: string, method: 'degree' | 'betweenness' | 'closeness' = 'degree'): number {
    if (method === 'degree') {
      const totalEntities = this.graph.getEntityCount();
      if (totalEntities <= 1) return 0;
      return this.getDegree(entityId) / (totalEntities - 1);
    }
    if (method === 'closeness') {
      const allIds = Array.from(this.graph.getAllEntities().keys());
      let totalDistance = 0;
      let reachable = 0;
      for (const targetId of allIds) {
        if (targetId === entityId) continue;
        const path = this.graph.shortestPath(entityId, targetId);
        if (path) {
          totalDistance += path.length;
          reachable++;
        }
      }
      if (reachable === 0) return 0;
      return reachable / (totalDistance * (allIds.length - 1));
    }
    const allIds = Array.from(this.graph.getAllEntities().keys());
    let betweenness = 0;
    for (const source of allIds) {
      for (const target of allIds) {
        if (source === entityId || target === entityId || source === target) continue;
        const path = this.graph.shortestPath(source, target);
        if (path && path.path.includes(entityId)) {
          betweenness++;
        }
      }
    }
    const n = allIds.length;
    const denom = (n - 1) * (n - 2);
    return denom > 0 ? betweenness / denom : 0;
  }

  countByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entity of this.graph.getAllEntities().values()) {
      counts[entity.type] = (counts[entity.type] ?? 0) + 1;
    }
    return counts;
  }

  searchByName(query: string, options?: { fuzzy?: boolean; limit?: number }): Entity[] {
    const lowerQuery = query.toLowerCase();
    let results = Array.from(this.graph.getAllEntities().values()).filter((e) =>
      e.name.toLowerCase().includes(lowerQuery)
    );
    if (options?.fuzzy) {
      const fuzzyResults = Array.from(this.graph.getAllEntities().values()).filter((e) => {
        if (results.some((r) => r.id === e.id)) return false;
        return this.levenshtein(e.name.toLowerCase(), lowerQuery) <= Math.floor(lowerQuery.length * 0.4);
      });
      results = [...results, ...fuzzyResults];
    }
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }
    return results;
  }

  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = a[j - 1] === b[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
      }
    }
    return matrix[b.length][a.length];
  }
}
