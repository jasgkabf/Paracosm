import type { Entity, Relation, EntityType, RelationType } from '@paracosm/shared';
import { generateId, ok, err, type Result } from '@paracosm/shared';
import type { GraphTraversalOptions, PathResult, SubgraphResult, GraphQueryOptions, GraphMergeOptions, GraphDiffResult } from './types.js';

export class EntityGraph {
  private entities: Map<string, Entity> = new Map();
  private relations: Map<string, Relation> = new Map();
  private adjacency: Map<string, Map<string, string[]>> = new Map();
  private reverseAdjacency: Map<string, Map<string, string[]>> = new Map();
  private entityIndexByType: Map<EntityType, Set<string>> = new Map();
  private relationIndexByType: Map<RelationType, Set<string>> = new Map();
  private listeners: Array<(event: string, data: unknown) => void> = [];

  on(listener: (event: string, data: unknown) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  private emit(event: string, data: unknown): void {
    for (const listener of this.listeners) {
      listener(event, data);
    }
  }

  addEntity(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Result<Entity> {
    const id = entity.id ?? generateId();
    if (this.entities.has(id)) {
      return err(new Error(`Entity with id ${id} already exists`));
    }
    const now = new Date();
    const newEntity: Entity = {
      ...entity,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.entities.set(id, newEntity);
    if (!this.adjacency.has(id)) {
      this.adjacency.set(id, new Map());
    }
    if (!this.reverseAdjacency.has(id)) {
      this.reverseAdjacency.set(id, new Map());
    }
    const typeSet = this.entityIndexByType.get(newEntity.type) ?? new Set();
    typeSet.add(id);
    this.entityIndexByType.set(newEntity.type, typeSet);
    this.emit('entity:added', newEntity);
    return ok(newEntity);
  }

  removeEntity(id: string): Result<boolean> {
    const entity = this.entities.get(id);
    if (!entity) {
      return err(new Error(`Entity with id ${id} not found`));
    }
    const relationsToRemove: string[] = [];
    for (const [relId, relation] of this.relations) {
      if (relation.sourceId === id || relation.targetId === id) {
        relationsToRemove.push(relId);
      }
    }
    for (const relId of relationsToRemove) {
      this.removeRelation(relId);
    }
    this.entities.delete(id);
    this.adjacency.delete(id);
    this.reverseAdjacency.delete(id);
    for (const [, targets] of this.adjacency) {
      targets.delete(id);
    }
    for (const [, sources] of this.reverseAdjacency) {
      sources.delete(id);
    }
    const typeSet = this.entityIndexByType.get(entity.type);
    if (typeSet) {
      typeSet.delete(id);
      if (typeSet.size === 0) {
        this.entityIndexByType.delete(entity.type);
      }
    }
    this.emit('entity:removed', entity);
    return ok(true);
  }

  updateEntity(id: string, updates: Partial<Omit<Entity, 'id' | 'createdAt'>>): Result<Entity> {
    const entity = this.entities.get(id);
    if (!entity) {
      return err(new Error(`Entity with id ${id} not found`));
    }
    const oldType = entity.type;
    const updated: Entity = {
      ...entity,
      ...updates,
      id,
      createdAt: entity.createdAt,
      updatedAt: new Date(),
    };
    this.entities.set(id, updated);
    if (updates.type && updates.type !== oldType) {
      const oldSet = this.entityIndexByType.get(oldType);
      if (oldSet) {
        oldSet.delete(id);
        if (oldSet.size === 0) this.entityIndexByType.delete(oldType);
      }
      const newSet = this.entityIndexByType.get(updated.type) ?? new Set();
      newSet.add(id);
      this.entityIndexByType.set(updated.type, newSet);
    }
    this.emit('entity:updated', { before: entity, after: updated });
    return ok(updated);
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  addRelation(relation: Omit<Relation, 'id' | 'createdAt'> & { id?: string }): Result<Relation> {
    const id = relation.id ?? generateId();
    if (this.relations.has(id)) {
      return err(new Error(`Relation with id ${id} already exists`));
    }
    if (!this.entities.has(relation.sourceId)) {
      return err(new Error(`Source entity ${relation.sourceId} not found`));
    }
    if (!this.entities.has(relation.targetId)) {
      return err(new Error(`Target entity ${relation.targetId} not found`));
    }
    const newRelation: Relation = {
      ...relation,
      id,
      createdAt: new Date(),
    };
    this.relations.set(id, newRelation);
    const forward = this.adjacency.get(relation.sourceId) ?? new Map();
    const rels = forward.get(relation.targetId) ?? [];
    rels.push(id);
    forward.set(relation.targetId, rels);
    this.adjacency.set(relation.sourceId, forward);
    const backward = this.reverseAdjacency.get(relation.targetId) ?? new Map();
    const backRels = backward.get(relation.sourceId) ?? [];
    backRels.push(id);
    backward.set(relation.sourceId, backRels);
    this.reverseAdjacency.set(relation.targetId, backward);
    const typeSet = this.relationIndexByType.get(newRelation.type) ?? new Set();
    typeSet.add(id);
    this.relationIndexByType.set(newRelation.type, typeSet);
    this.emit('relation:added', newRelation);
    return ok(newRelation);
  }

  removeRelation(id: string): Result<boolean> {
    const relation = this.relations.get(id);
    if (!relation) {
      return err(new Error(`Relation with id ${id} not found`));
    }
    this.relations.delete(id);
    const forward = this.adjacency.get(relation.sourceId);
    if (forward) {
      const rels = forward.get(relation.targetId);
      if (rels) {
        const idx = rels.indexOf(id);
        if (idx !== -1) rels.splice(idx, 1);
        if (rels.length === 0) forward.delete(relation.targetId);
      }
    }
    const backward = this.reverseAdjacency.get(relation.targetId);
    if (backward) {
      const rels = backward.get(relation.sourceId);
      if (rels) {
        const idx = rels.indexOf(id);
        if (idx !== -1) rels.splice(idx, 1);
        if (rels.length === 0) backward.delete(relation.sourceId);
      }
    }
    const typeSet = this.relationIndexByType.get(relation.type);
    if (typeSet) {
      typeSet.delete(id);
      if (typeSet.size === 0) this.relationIndexByType.delete(relation.type);
    }
    this.emit('relation:removed', relation);
    return ok(true);
  }

  updateRelation(id: string, updates: Partial<Omit<Relation, 'id' | 'createdAt'>>): Result<Relation> {
    const relation = this.relations.get(id);
    if (!relation) {
      return err(new Error(`Relation with id ${id} not found`));
    }
    const oldType = relation.type;
    const updated: Relation = { ...relation, ...updates, id, createdAt: relation.createdAt };
    this.relations.set(id, updated);
    if (updates.type && updates.type !== oldType) {
      const oldSet = this.relationIndexByType.get(oldType);
      if (oldSet) {
        oldSet.delete(id);
        if (oldSet.size === 0) this.relationIndexByType.delete(oldType);
      }
      const newSet = this.relationIndexByType.get(updated.type) ?? new Set();
      newSet.add(id);
      this.relationIndexByType.set(updated.type, newSet);
    }
    this.emit('relation:updated', { before: relation, after: updated });
    return ok(updated);
  }

  getRelation(id: string): Relation | undefined {
    return this.relations.get(id);
  }

  queryByType(type: EntityType): Entity[] {
    const ids = this.entityIndexByType.get(type);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.entities.get(id))
      .filter((e): e is Entity => e !== undefined);
  }

  queryByRelation(relationType: RelationType, entityId?: string): Relation[] {
    const ids = this.relationIndexByType.get(relationType);
    if (!ids) return [];
    let relations = Array.from(ids)
      .map((id) => this.relations.get(id))
      .filter((r): r is Relation => r !== undefined);
    if (entityId) {
      relations = relations.filter((r) => r.sourceId === entityId || r.targetId === entityId);
    }
    return relations;
  }

  getRelatedEntities(entityId: string, direction: 'outgoing' | 'incoming' | 'both' = 'both'): Entity[] {
    const result: Entity[] = [];
    const seen = new Set<string>();
    if (direction === 'outgoing' || direction === 'both') {
      const forward = this.adjacency.get(entityId);
      if (forward) {
        for (const targetId of forward.keys()) {
          if (!seen.has(targetId)) {
            seen.add(targetId);
            const entity = this.entities.get(targetId);
            if (entity) result.push(entity);
          }
        }
      }
    }
    if (direction === 'incoming' || direction === 'both') {
      const backward = this.reverseAdjacency.get(entityId);
      if (backward) {
        for (const sourceId of backward.keys()) {
          if (!seen.has(sourceId)) {
            seen.add(sourceId);
            const entity = this.entities.get(sourceId);
            if (entity) result.push(entity);
          }
        }
      }
    }
    return result;
  }

  traverse(startId: string, options: GraphTraversalOptions = {
    maxDepth: 10,
    direction: 'both',
    includeInactive: false,
  }): Entity[] {
    const visited = new Set<string>();
    const result: Entity[] = [];
    const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
    visited.add(startId);
    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (depth > options.maxDepth) continue;
      const entity = this.entities.get(id);
      if (entity) result.push(entity);
      if (depth === options.maxDepth) continue;
      const neighbors = this.getNeighborIds(id, options.direction);
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          const relationIds = this.getRelationIdsBetween(id, neighborId, options.direction);
          if (options.relationTypes && options.relationTypes.length > 0) {
            const hasMatchingRelation = relationIds.some((relId) => {
              const rel = this.relations.get(relId);
              return rel && options.relationTypes!.includes(rel.type);
            });
            if (!hasMatchingRelation) continue;
          }
          visited.add(neighborId);
          queue.push({ id: neighborId, depth: depth + 1 });
        }
      }
    }
    return result;
  }

  shortestPath(fromId: string, toId: string, options?: { relationTypes?: string[]; maxDepth?: number }): PathResult | null {
    const maxDepth = options?.maxDepth ?? 20;
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[]; relationTypes: string[]; weight: number }> = [
      { id: fromId, path: [fromId], relationTypes: [], weight: 0 },
    ];
    visited.add(fromId);
    while (queue.length > 0) {
      queue.sort((a, b) => a.weight - b.weight);
      const current = queue.shift()!;
      if (current.id === toId) {
        return {
          path: current.path,
          length: current.path.length - 1,
          weight: current.weight,
          relationTypes: current.relationTypes,
        };
      }
      if (current.path.length > maxDepth) continue;
      const neighbors = this.getNeighborIds(current.id, 'both');
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          const relationIds = this.getRelationIdsBetween(current.id, neighborId, 'both');
          for (const relId of relationIds) {
            const rel = this.relations.get(relId);
            if (!rel) continue;
            if (options?.relationTypes && options.relationTypes.length > 0 && !options.relationTypes.includes(rel.type)) continue;
            visited.add(neighborId);
            queue.push({
              id: neighborId,
              path: [...current.path, neighborId],
              relationTypes: [...current.relationTypes, rel.type],
              weight: current.weight + (1 - rel.strength),
            });
          }
        }
      }
    }
    return null;
  }

  subgraph(entityIds: string[], options?: { includeRelations: boolean }): SubgraphResult {
    const includeRelations = options?.includeRelations ?? true;
    const entities: Entity[] = [];
    const relations: Relation[] = [];
    const boundaryEntities: string[] = [];
    const idSet = new Set(entityIds);
    for (const id of entityIds) {
      const entity = this.entities.get(id);
      if (entity) entities.push(entity);
    }
    if (includeRelations) {
      for (const [relId, relation] of this.relations) {
        if (idSet.has(relation.sourceId) && idSet.has(relation.targetId)) {
          relations.push(relation);
        } else if (idSet.has(relation.sourceId) && !idSet.has(relation.targetId)) {
          boundaryEntities.push(relation.targetId);
        } else if (!idSet.has(relation.sourceId) && idSet.has(relation.targetId)) {
          boundaryEntities.push(relation.sourceId);
        }
      }
    }
    return { entities, relations, boundaryEntities: [...new Set(boundaryEntities)] };
  }

  merge(other: EntityGraph, options: GraphMergeOptions = {
    conflictStrategy: 'ours',
    mergeRelations: true,
    mergeAttributes: true,
  }): Result<number> {
    let mergedCount = 0;
    for (const [id, entity] of other.getAllEntities()) {
      if (!this.entities.has(id)) {
        this.addEntity({ ...entity, id });
        mergedCount++;
      } else if (options.conflictStrategy === 'theirs') {
        this.updateEntity(id, entity);
        mergedCount++;
      } else if (options.conflictStrategy === 'latest') {
        const existing = this.entities.get(id)!;
        if (entity.updatedAt > existing.updatedAt) {
          this.updateEntity(id, entity);
          mergedCount++;
        }
      } else if (options.conflictStrategy === 'merge' && options.mergeAttributes) {
        const existing = this.entities.get(id)!;
        const merged = {
          ...existing,
          attributes: { ...existing.attributes, ...entity.attributes },
          metadata: { ...existing.metadata, ...entity.metadata },
          updatedAt: new Date(),
        };
        this.updateEntity(id, merged);
        mergedCount++;
      }
    }
    if (options.mergeRelations) {
      for (const [id, relation] of other.getAllRelations()) {
        if (!this.relations.has(id)) {
          if (this.entities.has(relation.sourceId) && this.entities.has(relation.targetId)) {
            this.addRelation({ ...relation, id });
            mergedCount++;
          }
        } else if (options.conflictStrategy === 'theirs') {
          this.updateRelation(id, relation);
          mergedCount++;
        }
      }
    }
    return ok(mergedCount);
  }

  diff(other: EntityGraph): GraphDiffResult {
    const addedEntities: Entity[] = [];
    const removedEntities: Entity[] = [];
    const modifiedEntities: Array<{ before: Entity; after: Entity }> = [];
    const addedRelations: Relation[] = [];
    const removedRelations: Relation[] = [];
    const modifiedRelations: Array<{ before: Relation; after: Relation }> = [];

    for (const [id, entity] of other.getAllEntities()) {
      if (!this.entities.has(id)) {
        addedEntities.push(entity);
      } else {
        const ours = this.entities.get(id)!;
        if (ours.updatedAt.getTime() !== entity.updatedAt.getTime() ||
            JSON.stringify(ours.attributes) !== JSON.stringify(entity.attributes)) {
          modifiedEntities.push({ before: ours, after: entity });
        }
      }
    }
    for (const [id, entity] of this.entities) {
      if (!other.getEntity(id)) {
        removedEntities.push(entity);
      }
    }
    for (const [id, relation] of other.getAllRelations()) {
      if (!this.relations.has(id)) {
        addedRelations.push(relation);
      } else {
        const ours = this.relations.get(id)!;
        if (ours.strength !== relation.strength ||
            ours.type !== relation.type ||
            JSON.stringify(ours.metadata) !== JSON.stringify(relation.metadata)) {
          modifiedRelations.push({ before: ours, after: relation });
        }
      }
    }
    for (const [id, relation] of this.relations) {
      if (!other.getRelation(id)) {
        removedRelations.push(relation);
      }
    }

    return { addedEntities, removedEntities, modifiedEntities, addedRelations, removedRelations, modifiedRelations };
  }

  getAllEntities(): Map<string, Entity> {
    return new Map(this.entities);
  }

  getAllRelations(): Map<string, Relation> {
    return new Map(this.relations);
  }

  getEntityCount(): number {
    return this.entities.size;
  }

  getRelationCount(): number {
    return this.relations.size;
  }

  clear(): void {
    this.entities.clear();
    this.relations.clear();
    this.adjacency.clear();
    this.reverseAdjacency.clear();
    this.entityIndexByType.clear();
    this.relationIndexByType.clear();
    this.emit('graph:cleared', null);
  }

  private getNeighborIds(entityId: string, direction: 'outgoing' | 'incoming' | 'both'): string[] {
    const neighbors: string[] = [];
    if (direction === 'outgoing' || direction === 'both') {
      const forward = this.adjacency.get(entityId);
      if (forward) {
        for (const targetId of forward.keys()) {
          neighbors.push(targetId);
        }
      }
    }
    if (direction === 'incoming' || direction === 'both') {
      const backward = this.reverseAdjacency.get(entityId);
      if (backward) {
        for (const sourceId of backward.keys()) {
          if (!neighbors.includes(sourceId)) {
            neighbors.push(sourceId);
          }
        }
      }
    }
    return neighbors;
  }

  private getRelationIdsBetween(fromId: string, toId: string, direction: 'outgoing' | 'incoming' | 'both'): string[] {
    const relationIds: string[] = [];
    if (direction === 'outgoing' || direction === 'both') {
      const forward = this.adjacency.get(fromId);
      if (forward) {
        const rels = forward.get(toId);
        if (rels) relationIds.push(...rels);
      }
    }
    if (direction === 'incoming' || direction === 'both') {
      const backward = this.reverseAdjacency.get(fromId);
      if (backward) {
        const rels = backward.get(toId);
        if (rels) relationIds.push(...rels);
      }
    }
    return relationIds;
  }
}
