import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { EntityType, RelationType } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import { Entity } from "./entity.js";
import { Relation } from "./relation.js";
import type {
  EntityRecord,
  RelationRecord,
  GraphData,
  TraversalOptions,
  GraphDiff,
  GraphSnapshot,
} from "./types.js";

export class EntityGraph {
  private entities: Map<string, EntityRecord>;
  private relations: Map<string, RelationRecord>;
  private adjacency: Map<string, Set<string>>;
  private reverseAdjacency: Map<string, Set<string>>;
  private edgeIndex: Map<string, string[]>;
  private reverseEdgeIndex: Map<string, string[]>;
  private typeIndex: Map<EntityType, Set<string>>;
  private relationTypeIndex: Map<RelationType, Set<string>>;
  private version: number;

  constructor() {
    this.entities = new Map();
    this.relations = new Map();
    this.adjacency = new Map();
    this.reverseAdjacency = new Map();
    this.edgeIndex = new Map();
    this.reverseEdgeIndex = new Map();
    this.typeIndex = new Map();
    this.relationTypeIndex = new Map();
    this.version = 0;
  }

  addEntity(params: { name: string; type: EntityType; description?: string; properties?: Record<string, unknown>; tags?: string[]; metadata?: Record<string, unknown>; parentId?: string | null }): Result<EntityRecord, ValidationError> {
    const result = Entity.create(params);
    if (!result.ok) {
      return result;
    }

    const record = result.value;

    if (params.parentId) {
      const parent = this.entities.get(params.parentId);
      if (!parent) {
        return err(new ValidationError("Parent entity not found", {
          parentId: params.parentId,
        }));
      }
    }

    this.entities.set(record.id, record);
    this.addToTypeIndex(record);

    if (record.parentId) {
      const parent = this.entities.get(record.parentId);
      if (parent) {
        parent.childIds.add(record.id);
        parent.updatedAt = new Date().toISOString();
      }
    }

    this.version++;
    return ok(record);
  }

  removeEntity(id: string): Result<true, ValidationError> {
    const entity = this.entities.get(id);
    if (!entity) {
      return err(new ValidationError("Entity not found", { entityId: id }));
    }

    for (const childId of entity.childIds) {
      const child = this.entities.get(childId);
      if (child) {
        child.parentId = entity.parentId;
        child.updatedAt = new Date().toISOString();
      }
    }

    if (entity.parentId) {
      const parent = this.entities.get(entity.parentId);
      if (parent) {
        parent.childIds.delete(id);
        parent.updatedAt = new Date().toISOString();
      }
    }

    const relationsToRemove: string[] = [];
    for (const [relId, rel] of this.relations) {
      if (rel.sourceId === id || rel.targetId === id) {
        relationsToRemove.push(relId);
      }
    }

    for (const relId of relationsToRemove) {
      this.removeRelation(relId);
    }

    this.removeFromTypeIndex(entity);
    this.entities.delete(id);
    this.adjacency.delete(id);
    this.reverseAdjacency.delete(id);
    this.edgeIndex.delete(id);
    this.reverseEdgeIndex.delete(id);

    for (const [nodeId, neighbors] of this.adjacency) {
      neighbors.delete(id);
    }

    for (const [nodeId, neighbors] of this.reverseAdjacency) {
      neighbors.delete(id);
    }

    this.version++;
    return ok(true);
  }

  updateEntity(id: string, updates: Partial<Pick<EntityRecord, "name" | "description" | "properties" | "tags" | "metadata">>): Result<EntityRecord, ValidationError> {
    const entity = this.entities.get(id);
    if (!entity) {
      return err(new ValidationError("Entity not found", { entityId: id }));
    }

    if (updates.name !== undefined) {
      if (typeof updates.name !== "string" || updates.name.trim().length === 0) {
        return err(new ValidationError("Entity name must be a non-empty string", { field: "name" }));
      }
      entity.name = updates.name;
    }

    if (updates.description !== undefined) {
      entity.description = updates.description;
    }

    if (updates.properties !== undefined) {
      entity.properties = updates.properties instanceof Map
        ? updates.properties
        : new Map(Object.entries(updates.properties));
    }

    if (updates.tags !== undefined) {
      this.removeFromTypeIndex(entity);
      entity.tags = updates.tags instanceof Set ? updates.tags : new Set(updates.tags);
      this.addToTypeIndex(entity);
    }

    if (updates.metadata !== undefined) {
      entity.metadata = updates.metadata;
    }

    entity.updatedAt = new Date().toISOString();
    entity.version += 1;
    this.version++;

    return ok(Entity.clone(entity));
  }

  addRelation(params: { sourceId: string; targetId: string; type: RelationType; label?: string; weight?: number; bidirectional?: boolean; properties?: Record<string, unknown> }): Result<RelationRecord, ValidationError> {
    if (!this.entities.has(params.sourceId)) {
      return err(new ValidationError("Source entity not found", { sourceId: params.sourceId }));
    }

    if (!this.entities.has(params.targetId)) {
      return err(new ValidationError("Target entity not found", { targetId: params.targetId }));
    }

    const result = Relation.create(params);
    if (!result.ok) {
      return result;
    }

    const record = result.value;

    const existingRelations = Array.from(this.relations.values()).filter(
      (r) => r.relationType === params.type
    );
    const relationHelper = new Relation();
    const cardinalityCheck = relationHelper.checkCardinality(
      params.type,
      existingRelations,
      params.sourceId,
      params.targetId
    );
    if (!cardinalityCheck.ok) {
      return cardinalityCheck;
    }

    this.relations.set(record.id, record);
    this.addToAdjacency(record);
    this.addToRelationTypeIndex(record);

    this.version++;
    return ok(record);
  }

  removeRelation(id: string): Result<true, ValidationError> {
    const relation = this.relations.get(id);
    if (!relation) {
      return err(new ValidationError("Relation not found", { relationId: id }));
    }

    this.removeFromAdjacency(relation);
    this.removeFromRelationTypeIndex(relation);
    this.relations.delete(id);

    this.version++;
    return ok(true);
  }

  updateRelation(id: string, updates: Partial<Pick<RelationRecord, "label" | "weight" | "properties">>): Result<RelationRecord, ValidationError> {
    const relation = this.relations.get(id);
    if (!relation) {
      return err(new ValidationError("Relation not found", { relationId: id }));
    }

    if (updates.label !== undefined) {
      relation.label = updates.label;
    }

    if (updates.weight !== undefined) {
      if (typeof updates.weight !== "number" || updates.weight < 0 || updates.weight > 1) {
        return err(new ValidationError("Relation weight must be between 0 and 1", { field: "weight" }));
      }
      relation.weight = updates.weight;
    }

    if (updates.properties !== undefined) {
      relation.properties = updates.properties instanceof Map
        ? updates.properties
        : new Map(Object.entries(updates.properties));
    }

    relation.updatedAt = new Date().toISOString();
    relation.version += 1;
    this.version++;

    return ok({ ...relation });
  }

  getEntity(id: string): EntityRecord | undefined {
    return this.entities.get(id);
  }

  getRelation(id: string): RelationRecord | undefined {
    return this.relations.get(id);
  }

  queryByType(type: EntityType): EntityRecord[] {
    const ids = this.typeIndex.get(type);
    if (!ids) return [];
    const results: EntityRecord[] = [];
    for (const id of ids) {
      const entity = this.entities.get(id);
      if (entity) {
        results.push(entity);
      }
    }
    return results;
  }

  queryByRelation(entityId: string, relationType?: RelationType, direction: "outgoing" | "incoming" | "both" = "outgoing"): EntityRecord[] {
    const results: EntityRecord[] = [];
    const seen = new Set<string>();

    const collectNeighbors = (edgeIds: string[]): void => {
      for (const relId of edgeIds) {
        const rel = this.relations.get(relId);
        if (!rel) continue;
        if (relationType !== undefined && rel.relationType !== relationType) continue;

        const neighborId = rel.sourceId === entityId ? rel.targetId : rel.sourceId;
        if (!seen.has(neighborId)) {
          seen.add(neighborId);
          const neighbor = this.entities.get(neighborId);
          if (neighbor) {
            results.push(neighbor);
          }
        }
      }
    };

    if (direction === "outgoing" || direction === "both") {
      const outEdges = this.edgeIndex.get(entityId) ?? [];
      collectNeighbors(outEdges);
    }

    if (direction === "incoming" || direction === "both") {
      const inEdges = this.reverseEdgeIndex.get(entityId) ?? [];
      collectNeighbors(inEdges);
    }

    return results;
  }

  traverse(startId: string, options: TraversalOptions = { maxDepth: 10, direction: "outgoing" }): EntityRecord[] {
    const startEntity = this.entities.get(startId);
    if (!startEntity) return [];

    const visited = new Set<string>();
    const results: EntityRecord[] = [];
    const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (visited.has(id)) continue;
      if (depth > options.maxDepth) continue;

      visited.add(id);
      const entity = this.entities.get(id);
      if (!entity) continue;

      if (options.nodeFilter && !options.nodeFilter({ id: entity.id, type: entity.entityType, label: entity.name, data: {}, createdAt: entity.createdAt, updatedAt: entity.updatedAt })) {
        continue;
      }

      if (depth > 0) {
        results.push(entity);
      }

      if (depth >= options.maxDepth) continue;

      const neighborIds = this.getNeighborIds(id, options.direction);
      for (const neighborId of neighborIds) {
        if (!visited.has(neighborId)) {
          const edgeIds = this.getEdgeIdsBetween(id, neighborId, options.direction);
          const edgeValid = options.edgeFilter
            ? edgeIds.some((eid) => {
                const rel = this.relations.get(eid);
                return rel && options.edgeFilter!({
                  id: rel.id, sourceId: rel.sourceId, targetId: rel.targetId,
                  type: rel.relationType, label: rel.label, weight: rel.weight,
                  bidirectional: rel.bidirectional, data: {}, createdAt: rel.createdAt, updatedAt: rel.updatedAt,
                });
              })
            : true;

          if (edgeValid) {
            queue.push({ id: neighborId, depth: depth + 1 });
          }
        }
      }
    }

    return results;
  }

  traverseDFS(startId: string, options: TraversalOptions = { maxDepth: 10, direction: "outgoing" }): EntityRecord[] {
    const startEntity = this.entities.get(startId);
    if (!startEntity) return [];

    const visited = new Set<string>();
    const results: EntityRecord[] = [];
    const stack: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];

    while (stack.length > 0) {
      const { id, depth } = stack.pop()!;

      if (visited.has(id)) continue;
      if (depth > options.maxDepth) continue;

      visited.add(id);
      const entity = this.entities.get(id);
      if (!entity) continue;

      if (options.nodeFilter && !options.nodeFilter({ id: entity.id, type: entity.entityType, label: entity.name, data: {}, createdAt: entity.createdAt, updatedAt: entity.updatedAt })) {
        continue;
      }

      if (depth > 0) {
        results.push(entity);
      }

      if (depth >= options.maxDepth) continue;

      const neighborIds = this.getNeighborIds(id, options.direction);
      for (const neighborId of neighborIds) {
        if (!visited.has(neighborId)) {
          stack.push({ id: neighborId, depth: depth + 1 });
        }
      }
    }

    return results;
  }

  shortestPath(sourceId: string, targetId: string): string[] {
    if (!this.entities.has(sourceId) || !this.entities.has(targetId)) {
      return [];
    }

    if (sourceId === targetId) {
      return [sourceId];
    }

    const visited = new Set<string>();
    const parent = new Map<string, string>();
    const queue: string[] = [sourceId];
    visited.add(sourceId);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current === targetId) {
        const path: string[] = [];
        let nodeId: string | undefined = targetId;
        while (nodeId !== undefined) {
          path.unshift(nodeId);
          nodeId = parent.get(nodeId);
        }
        return path;
      }

      const neighbors = this.getNeighborIds(current, "both");
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          parent.set(neighborId, current);
          queue.push(neighborId);
        }
      }
    }

    return [];
  }

  subgraph(entityIds: string[]): EntityGraph {
    const sub = new EntityGraph();
    const idSet = new Set(entityIds);

    for (const id of entityIds) {
      const entity = this.entities.get(id);
      if (entity) {
        sub.entities.set(id, Entity.clone(entity));
        sub.addToTypeIndex(entity);
      }
    }

    for (const [relId, rel] of this.relations) {
      if (idSet.has(rel.sourceId) && idSet.has(rel.targetId)) {
        sub.relations.set(relId, { ...rel, properties: new Map(rel.properties) });
        sub.addToAdjacency(rel);
        sub.addToRelationTypeIndex(rel);
      }
    }

    return sub;
  }

  merge(other: EntityGraph): Result<true, ValidationError> {
    for (const [id, entity] of other.entities) {
      if (this.entities.has(id)) {
        const existing = this.entities.get(id)!;
        const merged = Entity.merge(existing, entity);
        this.entities.set(id, merged);
        this.removeFromTypeIndex(existing);
        this.addToTypeIndex(merged);
      } else {
        this.entities.set(id, Entity.clone(entity));
        this.addToTypeIndex(entity);
      }
    }

    for (const [id, relation] of other.relations) {
      if (!this.relations.has(id)) {
        this.relations.set(id, { ...relation, properties: new Map(relation.properties) });
        this.addToAdjacency(relation);
        this.addToRelationTypeIndex(relation);
      }
    }

    this.version++;
    return ok(true);
  }

  diff(other: EntityGraph): GraphDiff {
    const result: GraphDiff = {
      addedNodes: [],
      removedNodes: [],
      modifiedNodes: [],
      addedEdges: [],
      removedEdges: [],
      modifiedEdges: [],
    };

    for (const [id, entity] of other.entities) {
      if (!this.entities.has(id)) {
        result.addedNodes.push(this.entityToGraphNode(entity));
      } else {
        const thisEntity = this.entities.get(id)!;
        const diffs = Entity.diff(thisEntity, entity);
        if (diffs.length > 0) {
          result.modifiedNodes.push({
            id,
            before: this.entityToGraphNode(thisEntity),
            after: this.entityToGraphNode(entity),
          });
        }
      }
    }

    for (const [id] of this.entities) {
      if (!other.entities.has(id)) {
        result.removedNodes.push(id);
      }
    }

    for (const [id, relation] of other.relations) {
      if (!this.relations.has(id)) {
        result.addedEdges.push(this.relationToGraphEdge(relation));
      } else {
        const thisRel = this.relations.get(id)!;
        if (thisRel.label !== relation.label || thisRel.weight !== relation.weight || thisRel.relationType !== relation.relationType) {
          result.modifiedEdges.push({
            id,
            before: this.relationToGraphEdge(thisRel),
            after: this.relationToGraphEdge(relation),
          });
        }
      }
    }

    for (const [id] of this.relations) {
      if (!other.relations.has(id)) {
        result.removedEdges.push(id);
      }
    }

    return result;
  }

  snapshot(): GraphSnapshot {
    const data: GraphData = {
      nodes: new Map(),
      edges: new Map(),
      adjacency: new Map(),
      reverseAdjacency: new Map(),
      edgeIndex: new Map(),
      reverseEdgeIndex: new Map(),
    };

    for (const [id, entity] of this.entities) {
      data.nodes.set(id, this.entityToGraphNode(entity));
    }

    for (const [id, relation] of this.relations) {
      data.edges.set(id, this.relationToGraphEdge(relation));
    }

    for (const [id, neighbors] of this.adjacency) {
      data.adjacency.set(id, new Set(neighbors));
    }

    for (const [id, neighbors] of this.reverseAdjacency) {
      data.reverseAdjacency.set(id, new Set(neighbors));
    }

    for (const [id, edgeIds] of this.edgeIndex) {
      data.edgeIndex.set(id, [...edgeIds]);
    }

    for (const [id, edgeIds] of this.reverseEdgeIndex) {
      data.reverseEdgeIndex.set(id, [...edgeIds]);
    }

    return {
      id: `snap_${Date.now()}`,
      timestamp: new Date().toISOString(),
      version: this.version,
      checksum: this.computeChecksum(),
      data,
    };
  }

  entityCount(): number {
    return this.entities.size;
  }

  relationCount(): number {
    return this.relations.size;
  }

  getVersion(): number {
    return this.version;
  }

  getAllEntities(): EntityRecord[] {
    return Array.from(this.entities.values());
  }

  getAllRelations(): RelationRecord[] {
    return Array.from(this.relations.values());
  }

  getRelationsForEntity(entityId: string): RelationRecord[] {
    const results: RelationRecord[] = [];
    const outEdges = this.edgeIndex.get(entityId) ?? [];
    const inEdges = this.reverseEdgeIndex.get(entityId) ?? [];

    for (const relId of outEdges) {
      const rel = this.relations.get(relId);
      if (rel) results.push(rel);
    }

    for (const relId of inEdges) {
      const rel = this.relations.get(relId);
      if (rel) results.push(rel);
    }

    return results;
  }

  hasEntity(id: string): boolean {
    return this.entities.has(id);
  }

  hasRelation(id: string): boolean {
    return this.relations.has(id);
  }

  clear(): void {
    this.entities.clear();
    this.relations.clear();
    this.adjacency.clear();
    this.reverseAdjacency.clear();
    this.edgeIndex.clear();
    this.reverseEdgeIndex.clear();
    this.typeIndex.clear();
    this.relationTypeIndex.clear();
    this.version++;
  }

  private addToTypeIndex(entity: EntityRecord): void {
    if (!this.typeIndex.has(entity.entityType)) {
      this.typeIndex.set(entity.entityType, new Set());
    }
    this.typeIndex.get(entity.entityType)!.add(entity.id);
  }

  private removeFromTypeIndex(entity: EntityRecord): void {
    const index = this.typeIndex.get(entity.entityType);
    if (index) {
      index.delete(entity.id);
      if (index.size === 0) {
        this.typeIndex.delete(entity.entityType);
      }
    }
  }

  private addToRelationTypeIndex(relation: RelationRecord): void {
    if (!this.relationTypeIndex.has(relation.relationType)) {
      this.relationTypeIndex.set(relation.relationType, new Set());
    }
    this.relationTypeIndex.get(relation.relationType)!.add(relation.id);
  }

  private removeFromRelationTypeIndex(relation: RelationRecord): void {
    const index = this.relationTypeIndex.get(relation.relationType);
    if (index) {
      index.delete(relation.id);
      if (index.size === 0) {
        this.relationTypeIndex.delete(relation.relationType);
      }
    }
  }

  private addToAdjacency(relation: RelationRecord): void {
    if (!this.adjacency.has(relation.sourceId)) {
      this.adjacency.set(relation.sourceId, new Set());
    }
    this.adjacency.get(relation.sourceId)!.add(relation.targetId);

    if (!this.reverseAdjacency.has(relation.targetId)) {
      this.reverseAdjacency.set(relation.targetId, new Set());
    }
    this.reverseAdjacency.get(relation.targetId)!.add(relation.sourceId);

    if (!this.edgeIndex.has(relation.sourceId)) {
      this.edgeIndex.set(relation.sourceId, []);
    }
    this.edgeIndex.get(relation.sourceId)!.push(relation.id);

    if (!this.reverseEdgeIndex.has(relation.targetId)) {
      this.reverseEdgeIndex.set(relation.targetId, []);
    }
    this.reverseEdgeIndex.get(relation.targetId)!.push(relation.id);

    if (relation.bidirectional) {
      if (!this.adjacency.has(relation.targetId)) {
        this.adjacency.set(relation.targetId, new Set());
      }
      this.adjacency.get(relation.targetId)!.add(relation.sourceId);

      if (!this.reverseAdjacency.has(relation.sourceId)) {
        this.reverseAdjacency.set(relation.sourceId, new Set());
      }
      this.reverseAdjacency.get(relation.sourceId)!.add(relation.targetId);
    }
  }

  private removeFromAdjacency(relation: RelationRecord): void {
    const sourceNeighbors = this.adjacency.get(relation.sourceId);
    if (sourceNeighbors) {
      sourceNeighbors.delete(relation.targetId);
      if (sourceNeighbors.size === 0) this.adjacency.delete(relation.sourceId);
    }

    const targetNeighbors = this.reverseAdjacency.get(relation.targetId);
    if (targetNeighbors) {
      targetNeighbors.delete(relation.sourceId);
      if (targetNeighbors.size === 0) this.reverseAdjacency.delete(relation.targetId);
    }

    const sourceEdges = this.edgeIndex.get(relation.sourceId);
    if (sourceEdges) {
      const idx = sourceEdges.indexOf(relation.id);
      if (idx >= 0) sourceEdges.splice(idx, 1);
      if (sourceEdges.length === 0) this.edgeIndex.delete(relation.sourceId);
    }

    const targetEdges = this.reverseEdgeIndex.get(relation.targetId);
    if (targetEdges) {
      const idx = targetEdges.indexOf(relation.id);
      if (idx >= 0) targetEdges.splice(idx, 1);
      if (targetEdges.length === 0) this.reverseEdgeIndex.delete(relation.targetId);
    }

    if (relation.bidirectional) {
      const targetOutNeighbors = this.adjacency.get(relation.targetId);
      if (targetOutNeighbors) {
        targetOutNeighbors.delete(relation.sourceId);
        if (targetOutNeighbors.size === 0) this.adjacency.delete(relation.targetId);
      }

      const sourceInNeighbors = this.reverseAdjacency.get(relation.sourceId);
      if (sourceInNeighbors) {
        sourceInNeighbors.delete(relation.targetId);
        if (sourceInNeighbors.size === 0) this.reverseAdjacency.delete(relation.sourceId);
      }
    }
  }

  private getNeighborIds(entityId: string, direction: "outgoing" | "incoming" | "both"): string[] {
    const neighbors = new Set<string>();

    if (direction === "outgoing" || direction === "both") {
      const outNeighbors = this.adjacency.get(entityId);
      if (outNeighbors) {
        for (const n of outNeighbors) neighbors.add(n);
      }
    }

    if (direction === "incoming" || direction === "both") {
      const inNeighbors = this.reverseAdjacency.get(entityId);
      if (inNeighbors) {
        for (const n of inNeighbors) neighbors.add(n);
      }
    }

    return Array.from(neighbors);
  }

  private getEdgeIdsBetween(sourceId: string, targetId: string, direction: "outgoing" | "incoming" | "both"): string[] {
    const edgeIds: string[] = [];

    if (direction === "outgoing" || direction === "both") {
      const outEdges = this.edgeIndex.get(sourceId) ?? [];
      for (const eid of outEdges) {
        const rel = this.relations.get(eid);
        if (rel && rel.targetId === targetId) edgeIds.push(eid);
      }
    }

    if (direction === "incoming" || direction === "both") {
      const inEdges = this.reverseEdgeIndex.get(sourceId) ?? [];
      for (const eid of inEdges) {
        const rel = this.relations.get(eid);
        if (rel && rel.sourceId === targetId) edgeIds.push(eid);
      }
    }

    return edgeIds;
  }

  private entityToGraphNode(entity: EntityRecord): import("./types.js").GraphNode {
    const data: Record<string, unknown> = {};
    for (const [key, value] of entity.properties) {
      data[key] = value;
    }
    return {
      id: entity.id,
      type: entity.entityType,
      label: entity.name,
      data,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private relationToGraphEdge(relation: RelationRecord): import("./types.js").GraphEdge {
    const data: Record<string, unknown> = {};
    for (const [key, value] of relation.properties) {
      data[key] = value;
    }
    return {
      id: relation.id,
      sourceId: relation.sourceId,
      targetId: relation.targetId,
      type: relation.relationType,
      label: relation.label,
      weight: relation.weight,
      bidirectional: relation.bidirectional,
      data,
      createdAt: relation.createdAt,
      updatedAt: relation.updatedAt,
    };
  }

  private computeChecksum(): string {
    const entityIds = Array.from(this.entities.keys()).sort();
    const relationIds = Array.from(this.relations.keys()).sort();
    const raw = JSON.stringify({ entities: entityIds, relations: relationIds, version: this.version });
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(16);
  }
}
