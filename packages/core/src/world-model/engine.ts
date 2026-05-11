import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { EntityType, RelationType, ConstraintType, ConstraintStatus, GoalPriority, GoalState, EventSeverity } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import { EntityGraph } from "./entity-graph.js";
import { Timeline } from "./timeline.js";
import { ConstraintMap } from "./constraint-map.js";
import { GoalStack } from "./goal-stack.js";
import { GraphQuery } from "./graph-query.js";
import { GraphIndex } from "./graph-index.js";
import { GraphPersistence } from "./graph-persistence.js";
import { GraphSerializer } from "./graph-serializer.js";
import { GraphDiff as GraphDiffUtils } from "./graph-diff.js";
import { GraphStats } from "./graph-stats.js";
import type {
  WorldModelConfig,
  WorldModelEvent,
  WorldModelEventName,
  WorldModelEventHandler,
  EntityRecord,
  RelationRecord,
  EventRecord,
  ConstraintRecord,
  GoalRecord,
  GraphDiff,
  GraphSnapshot,
  QueryPattern,
  EventPattern,
  ConstraintConflict,
  GoalDependency,
} from "./types.js";
import { DEFAULT_WORLD_MODEL_CONFIG } from "./types.js";

export class WorldModelEngine {
  private config: WorldModelConfig;
  private graph: EntityGraph;
  private timeline: Timeline;
  private constraintMap: ConstraintMap;
  private goalStack: GoalStack;
  private indexManager: GraphIndex;
  private persistence: GraphPersistence | null;
  private eventHandlers: Map<WorldModelEventName, Set<WorldModelEventHandler>>;
  private snapshots: Map<string, GraphSnapshot>;
  private initialized: boolean;
  private version: number;

  constructor(config?: Partial<WorldModelConfig>) {
    this.config = { ...DEFAULT_WORLD_MODEL_CONFIG, ...config };
    this.graph = new EntityGraph();
    this.timeline = new Timeline();
    this.constraintMap = new ConstraintMap();
    this.goalStack = new GoalStack();
    this.indexManager = new GraphIndex();
    this.persistence = null;
    this.eventHandlers = new Map();
    this.snapshots = new Map();
    this.initialized = false;
    this.version = 0;

    if (this.config.persistenceEnabled) {
      this.persistence = new GraphPersistence(this.config.persistencePath);
    }

    if (this.config.autoIndex) {
      this.setupDefaultIndexes();
    }
  }

  async init(): Promise<Result<true, ValidationError>> {
    if (this.initialized) {
      return err(new ValidationError("Engine is already initialized"));
    }

    if (this.persistence) {
      const loadResult = await this.persistence.load();
      if (loadResult.ok) {
        const data = loadResult.value;

        for (const [id, entity] of data.entities) {
          const addResult = this.graph.addEntity({
            name: entity.name,
            type: entity.entityType,
            description: entity.description,
            properties: Object.fromEntries(entity.properties),
            tags: Array.from(entity.tags),
            metadata: entity.metadata,
            parentId: entity.parentId,
          });
          if (addResult.ok) {
            this.graph.removeEntity(addResult.value.id);
            this.graph.addEntity({
              name: entity.name,
              type: entity.entityType,
              description: entity.description,
              properties: Object.fromEntries(entity.properties),
              tags: Array.from(entity.tags),
              metadata: entity.metadata,
              parentId: entity.parentId,
            });
          }
        }

        for (const [id, relation] of data.relations) {
          this.graph.addRelation({
            sourceId: relation.sourceId,
            targetId: relation.targetId,
            type: relation.relationType,
            label: relation.label,
            weight: relation.weight,
            bidirectional: relation.bidirectional,
            properties: Object.fromEntries(relation.properties),
          });
        }

        for (const causalLink of data.causalLinks) {
          this.timeline.addCausalLink(causalLink.causeId, causalLink.effectId, causalLink.strength, causalLink.delay);
        }
      }
    }

    if (this.config.autoIndex) {
      this.indexManager.rebuild(this.graph.getAllEntities(), this.graph.getAllRelations());
    }

    this.initialized = true;
    this.emit({ type: "engine:initialized", timestamp: new Date().toISOString(), data: {} });

    return ok(true);
  }

  async shutdown(): Promise<Result<true, ValidationError>> {
    if (!this.initialized) {
      return err(new ValidationError("Engine is not initialized"));
    }

    if (this.persistence && this.persistence.isDirty()) {
      await this.persistence.save(
        new Map(this.graph.getAllEntities().map((e) => [e.id, e])),
        new Map(this.graph.getAllRelations().map((r) => [r.id, r])),
        new Map(this.timeline.getAllEvents().map((e) => [e.id, e])),
        new Map(this.constraintMap.getAllConstraints().map((c) => [c.id, c])),
        new Map(this.goalStack.getAllGoals().map((g) => [g.id, g])),
        this.timeline.getAllCausalLinks()
      );
    }

    this.initialized = false;
    this.emit({ type: "engine:shutdown", timestamp: new Date().toISOString(), data: {} });

    return ok(true);
  }

  query(pattern?: QueryPattern): Result<EntityRecord[], ValidationError> {
    if (!this.initialized) {
      return err(new ValidationError("Engine is not initialized"));
    }

    const queryBuilder = new GraphQuery(this.graph, this.indexManager);

    if (pattern) {
      queryBuilder.match(pattern);
    }

    return queryBuilder.execute();
  }

  createQuery(): GraphQuery {
    return new GraphQuery(this.graph, this.indexManager);
  }

  addEntity(params: { name: string; type: EntityType; description?: string; properties?: Record<string, unknown>; tags?: string[]; metadata?: Record<string, unknown>; parentId?: string | null }): Result<EntityRecord, ValidationError> {
    if (!this.initialized) {
      return err(new ValidationError("Engine is not initialized"));
    }

    if (this.graph.entityCount() >= this.config.maxEntities) {
      return err(new ValidationError("Maximum entity count reached", {
        maxEntities: this.config.maxEntities,
      }));
    }

    const result = this.graph.addEntity(params);
    if (!result.ok) return result;

    const entity = result.value;

    if (this.config.autoIndex) {
      this.indexManager.addEntityToIndex(entity);
    }

    this.version++;
    this.emit({
      type: "entity:added",
      timestamp: new Date().toISOString(),
      data: { entityId: entity.id, entityType: entity.entityType },
    });

    return ok(entity);
  }

  removeEntity(id: string): Result<true, ValidationError> {
    if (!this.initialized) {
      return err(new ValidationError("Engine is not initialized"));
    }

    const entity = this.graph.getEntity(id);
    if (!entity) {
      return err(new ValidationError("Entity not found", { entityId: id }));
    }

    if (this.config.autoIndex) {
      this.indexManager.removeEntityFromIndex(entity);
    }

    const result = this.graph.removeEntity(id);
    if (!result.ok) return result;

    this.version++;
    this.emit({
      type: "entity:removed",
      timestamp: new Date().toISOString(),
      data: { entityId: id },
    });

    return ok(true);
  }

  updateEntity(id: string, updates: Partial<Pick<EntityRecord, "name" | "description" | "properties" | "tags" | "metadata">>): Result<EntityRecord, ValidationError> {
    if (!this.initialized) {
      return err(new ValidationError("Engine is not initialized"));
    }

    const oldEntity = this.graph.getEntity(id);
    if (!oldEntity) {
      return err(new ValidationError("Entity not found", { entityId: id }));
    }

    if (this.config.autoIndex) {
      this.indexManager.removeEntityFromIndex(oldEntity);
    }

    const result = this.graph.updateEntity(id, updates);
    if (!result.ok) return result;

    const updatedEntity = result.value;

    if (this.config.autoIndex) {
      this.indexManager.addEntityToIndex(updatedEntity);
    }

    this.version++;
    this.emit({
      type: "entity:updated",
      timestamp: new Date().toISOString(),
      data: { entityId: id },
    });

    return ok(updatedEntity);
  }

  addRelation(params: { sourceId: string; targetId: string; type: RelationType; label?: string; weight?: number; bidirectional?: boolean; properties?: Record<string, unknown> }): Result<RelationRecord, ValidationError> {
    if (!this.initialized) {
      return err(new ValidationError("Engine is not initialized"));
    }

    if (this.graph.relationCount() >= this.config.maxRelations) {
      return err(new ValidationError("Maximum relation count reached", {
        maxRelations: this.config.maxRelations,
      }));
    }

    const result = this.graph.addRelation(params);
    if (!result.ok) return result;

    const relation = result.value;

    if (this.config.autoIndex) {
      this.indexManager.addRelationToIndex(relation);
    }

    this.version++;
    this.emit({
      type: "relation:added",
      timestamp: new Date().toISOString(),
      data: { relationId: relation.id, relationType: relation.relationType },
    });

    return ok(relation);
  }

  removeRelation(id: string): Result<true, ValidationError> {
    if (!this.initialized) {
      return err(new ValidationError("Engine is not initialized"));
    }

    const relation = this.graph.getRelation(id);
    if (!relation) {
      return err(new ValidationError("Relation not found", { relationId: id }));
    }

    if (this.config.autoIndex) {
      this.indexManager.removeRelationFromIndex(relation);
    }

    const result = this.graph.removeRelation(id);
    if (!result.ok) return result;

    this.version++;
    this.emit({
      type: "relation:removed",
      timestamp: new Date().toISOString(),
      data: { relationId: id },
    });

    return ok(true);
  }

  addEvent(params: { name: string; description?: string; timestamp?: string; severity?: EventSeverity; entityId: string; payload?: Record<string, unknown>; duration?: number | null }): Result<EventRecord, ValidationError> {
    if (!this.initialized) {
      return err(new ValidationError("Engine is not initialized"));
    }

    if (this.timeline.eventCount() >= this.config.maxEvents) {
      return err(new ValidationError("Maximum event count reached", {
        maxEvents: this.config.maxEvents,
      }));
    }

    const result = this.timeline.addEvent(params);
    if (!result.ok) return result;

    const event = result.value;

    this.version++;
    this.emit({
      type: "event:added",
      timestamp: new Date().toISOString(),
      data: { eventId: event.id, eventName: event.name },
    });

    return ok(event);
  }

  addConstraint(params: { name: string; type: ConstraintType; description?: string; expression: string; priority?: number; penalty?: number; scope?: string[]; status?: ConstraintStatus }): Result<ConstraintRecord, ValidationError> {
    if (!this.initialized) {
      return err(new ValidationError("Engine is not initialized"));
    }

    if (this.constraintMap.constraintCount() >= this.config.maxConstraints) {
      return err(new ValidationError("Maximum constraint count reached", {
        maxConstraints: this.config.maxConstraints,
      }));
    }

    const result = this.constraintMap.addConstraint(params);
    if (!result.ok) return result;

    const constraint = result.value;

    this.version++;
    this.emit({
      type: "constraint:added",
      timestamp: new Date().toISOString(),
      data: { constraintId: constraint.id, constraintName: constraint.name },
    });

    return ok(constraint);
  }

  pushGoal(params: { name: string; description?: string; priority?: GoalPriority; successCriteria?: string; progress?: number; deadline?: string | null; assigneeId?: string | null; parentGoalId?: string | null }): Result<GoalRecord, ValidationError> {
    if (!this.initialized) {
      return err(new ValidationError("Engine is not initialized"));
    }

    if (this.goalStack.goalCount() >= this.config.maxGoals) {
      return err(new ValidationError("Maximum goal count reached", {
        maxGoals: this.config.maxGoals,
      }));
    }

    const result = this.goalStack.pushGoal(params);
    if (!result.ok) return result;

    const goal = result.value;

    this.version++;
    this.emit({
      type: "goal:added",
      timestamp: new Date().toISOString(),
      data: { goalId: goal.id, goalName: goal.name },
    });

    return ok(goal);
  }

  snapshot(): Result<GraphSnapshot, ValidationError> {
    if (!this.initialized) {
      return err(new ValidationError("Engine is not initialized"));
    }

    const snap = this.graph.snapshot();
    this.snapshots.set(snap.id, snap);

    this.emit({
      type: "snapshot:created",
      timestamp: new Date().toISOString(),
      data: { snapshotId: snap.id, version: snap.version },
    });

    return ok(snap);
  }

  restore(snapshotId: string): Result<true, ValidationError> {
    if (!this.initialized) {
      return err(new ValidationError("Engine is not initialized"));
    }

    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      return err(new ValidationError("Snapshot not found", { snapshotId }));
    }

    this.graph.clear();

    for (const [id, node] of snapshot.data.nodes) {
      this.graph.addEntity({
        name: node.label,
        type: node.type,
        properties: node.data,
      });
    }

    for (const [id, edge] of snapshot.data.edges) {
      this.graph.addRelation({
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        type: edge.type,
        label: edge.label,
        weight: edge.weight,
        bidirectional: edge.bidirectional,
        properties: edge.data,
      });
    }

    if (this.config.autoIndex) {
      this.indexManager.rebuild(this.graph.getAllEntities(), this.graph.getAllRelations());
    }

    this.version++;
    this.emit({
      type: "snapshot:restored",
      timestamp: new Date().toISOString(),
      data: { snapshotId, version: snapshot.version },
    });

    return ok(true);
  }

  async export(format: "json" | "binary" = "json"): Promise<Result<string | Buffer, ValidationError>> {
    if (!this.initialized) {
      return err(new ValidationError("Engine is not initialized"));
    }

    const entities = new Map(this.graph.getAllEntities().map((e) => [e.id, e]));
    const relations = new Map(this.graph.getAllRelations().map((r) => [r.id, r]));

    if (format === "json") {
      return GraphSerializer.serializeToJSON(entities, relations);
    } else {
      return GraphSerializer.serializeToBinary(entities, relations);
    }
  }

  async import(data: string | Buffer): Promise<Result<true, ValidationError>> {
    if (!this.initialized) {
      return err(new ValidationError("Engine is not initialized"));
    }

    let result: Result<{ entities: Map<string, EntityRecord>; relations: Map<string, RelationRecord> }, ValidationError>;

    if (typeof data === "string") {
      result = GraphSerializer.deserializeFromJSON(data);
    } else {
      result = GraphSerializer.deserializeFromBinary(data);
    }

    if (!result.ok) return result;

    const { entities, relations } = result.value;

    for (const [id, entity] of entities) {
      const addResult = this.graph.addEntity({
        name: entity.name,
        type: entity.entityType,
        description: entity.description,
        properties: Object.fromEntries(entity.properties),
        tags: Array.from(entity.tags),
        metadata: entity.metadata,
        parentId: entity.parentId,
      });
      if (addResult.ok && this.config.autoIndex) {
        this.indexManager.addEntityToIndex(addResult.value);
      }
    }

    for (const [id, relation] of relations) {
      const addResult = this.graph.addRelation({
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        type: relation.relationType,
        label: relation.label,
        weight: relation.weight,
        bidirectional: relation.bidirectional,
        properties: Object.fromEntries(relation.properties),
      });
      if (addResult.ok && this.config.autoIndex) {
        this.indexManager.addRelationToIndex(addResult.value);
      }
    }

    this.version++;
    this.emit({
      type: "graph:changed",
      timestamp: new Date().toISOString(),
      data: { importedEntities: entities.size, importedRelations: relations.size },
    });

    return ok(true);
  }

  getEntity(id: string): EntityRecord | undefined {
    return this.graph.getEntity(id);
  }

  getRelation(id: string): RelationRecord | undefined {
    return this.graph.getRelation(id);
  }

  getEvent(id: string): EventRecord | undefined {
    return this.timeline.getEvent(id);
  }

  getConstraint(id: string): ConstraintRecord | undefined {
    return this.constraintMap.getConstraint(id);
  }

  getGoal(id: string): GoalRecord | undefined {
    return this.goalStack.getGoal(id);
  }

  getEntityGraph(): EntityGraph {
    return this.graph;
  }

  getTimeline(): Timeline {
    return this.timeline;
  }

  getConstraintMap(): ConstraintMap {
    return this.constraintMap;
  }

  getGoalStack(): GoalStack {
    return this.goalStack;
  }

  getIndexManager(): GraphIndex {
    return this.indexManager;
  }

  getVersion(): number {
    return this.version;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getConfig(): WorldModelConfig {
    return { ...this.config };
  }

  getStats(): import("./graph-stats.js").GraphStatsResult {
    const entities = new Map(this.graph.getAllEntities().map((e) => [e.id, e]));
    const relations = new Map(this.graph.getAllRelations().map((r) => [r.id, r]));
    return GraphStats.compute(entities, relations);
  }

  on(event: WorldModelEventName, handler: WorldModelEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: WorldModelEventName, handler: WorldModelEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: WorldModelEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch {
          // swallow handler errors
        }
      }
    }

    const allHandlers = this.eventHandlers.get("graph:changed");
    if (allHandlers && event.type !== "graph:changed") {
      for (const handler of allHandlers) {
        try {
          handler(event);
        } catch {
          // swallow handler errors
        }
      }
    }
  }

  private setupDefaultIndexes(): void {
    this.indexManager.createIndex("type", "type");
    this.indexManager.createIndex("relation_type", "relation");
    this.indexManager.createIndex("tag", "tag");
  }
}
