import type { Entity, Relation, Event, CausalLink, Constraint, Goal, WorldModelState, EntityType, RelationType, ConstraintType, GoalPriority, GoalState } from '@paracosm/shared';
import { ok, err, type Result, generateId, createLogger } from '@paracosm/shared';
import { EntityGraph } from './entity-graph.js';
import { Timeline } from './timeline.js';
import { ConstraintMap } from './constraint-map.js';
import { GoalStack } from './goal-stack.js';
import { GraphQuery } from './graph-query.js';
import { GraphIndex } from './graph-index.js';
import { GraphPersistence } from './graph-persistence.js';
import { GraphSerializer } from './graph-serializer.js';
import { GraphDiff } from './graph-diff.js';
import { GraphStats } from './graph-stats.js';
import type { WorldModelConfig, GraphDiffResult, GraphStatsResult, ConstraintViolation, ConflictResolution, GoalDecomposition, PathResult, SubgraphResult, PatternDetectionResult, CausalChainResult, WorldModelEvent } from './types.js';
import { DEFAULT_WORLD_MODEL_CONFIG } from './types.js';
import { createEntity } from './entity.js';
import { createRelation } from './relation.js';
import { createEvent, createCausalLink } from './event.js';
import { createConstraint } from './constraint.js';
import { createGoal, computeGoalProgress, isGoalOverdue, getGoalUrgency } from './goal.js';

const logger = createLogger('WorldModelEngine');

export class WorldModelEngine {
  private config: WorldModelConfig;
  private entityGraph: EntityGraph;
  private timeline: Timeline;
  private constraintMap: ConstraintMap;
  private goalStack: GoalStack;
  private graphQuery: GraphQuery;
  private graphIndex: GraphIndex;
  private graphPersistence: GraphPersistence;
  private graphSerializer: GraphSerializer;
  private graphDiff: GraphDiff;
  private graphStats: GraphStats;
  private version: number = 0;
  private eventListeners: Map<string, Array<(data: unknown) => void>> = new Map();
  private snapshots: Map<string, WorldModelState> = new Map();

  constructor(config: Partial<WorldModelConfig> = {}) {
    this.config = { ...DEFAULT_WORLD_MODEL_CONFIG, ...config };
    this.entityGraph = new EntityGraph();
    this.timeline = new Timeline();
    this.constraintMap = new ConstraintMap();
    this.goalStack = new GoalStack();
    this.graphQuery = new GraphQuery(this.entityGraph);
    this.graphIndex = new GraphIndex(this.entityGraph);
    this.graphPersistence = new GraphPersistence(this.config);
    this.graphSerializer = new GraphSerializer(this.config);
    this.graphDiff = new GraphDiff();
    this.graphStats = new GraphStats(this.entityGraph);
    this.setupInternalListeners();
    logger.info('WorldModelEngine initialized');
  }

  private setupInternalListeners(): void {
    this.entityGraph.on((event, data) => {
      this.emitEvent(event, data);
      if (this.config.autoVersion) this.incrementVersion();
    });
    this.timeline.on((event, data) => {
      this.emitEvent(event, data);
      if (this.config.autoVersion) this.incrementVersion();
    });
    this.constraintMap.on((event, data) => {
      this.emitEvent(event, data);
      if (this.config.autoVersion) this.incrementVersion();
    });
    this.goalStack.on((event, data) => {
      this.emitEvent(event, data);
      if (this.config.autoVersion) this.incrementVersion();
    });
  }

  on(event: string, listener: (data: unknown) => void): () => void {
    const listeners = this.eventListeners.get(event) ?? [];
    listeners.push(listener);
    this.eventListeners.set(event, listeners);
    return () => {
      const list = this.eventListeners.get(event);
      if (list) {
        const idx = list.indexOf(listener);
        if (idx !== -1) list.splice(idx, 1);
      }
    };
  }

  private emitEvent(event: string, data: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch (error) {
          logger.error(`Event listener error for ${event}: ${error}`);
        }
      }
    }
    const allListeners = this.eventListeners.get('*');
    if (allListeners) {
      for (const listener of allListeners) {
        try {
          listener({ event, data });
        } catch (error) {
          logger.error(`Wildcard listener error: ${error}`);
        }
      }
    }
  }

  private incrementVersion(): void {
    this.version++;
  }

  addEntity(data: { name: string; type: EntityType; description: string; attributes?: Record<string, unknown>; metadata?: Record<string, unknown>; id?: string }): Result<Entity> {
    if (this.entityGraph.getEntityCount() >= this.config.maxEntities) {
      return err(new Error(`Maximum entity count (${this.config.maxEntities}) reached`));
    }
    const entity = createEntity(data);
    return this.entityGraph.addEntity(entity);
  }

  removeEntity(id: string): Result<boolean> {
    return this.entityGraph.removeEntity(id);
  }

  updateEntity(id: string, updates: Partial<Omit<Entity, 'id' | 'createdAt'>>): Result<Entity> {
    return this.entityGraph.updateEntity(id, updates);
  }

  getEntity(id: string): Entity | undefined {
    return this.entityGraph.getEntity(id);
  }

  addRelation(data: { sourceId: string; targetId: string; type: RelationType; strength?: number; description?: string; metadata?: Record<string, unknown>; id?: string }): Result<Relation> {
    if (this.entityGraph.getRelationCount() >= this.config.maxRelations) {
      return err(new Error(`Maximum relation count (${this.config.maxRelations}) reached`));
    }
    const relation = createRelation(data);
    return this.entityGraph.addRelation(relation);
  }

  removeRelation(id: string): Result<boolean> {
    return this.entityGraph.removeRelation(id);
  }

  updateRelation(id: string, updates: Partial<Omit<Relation, 'id' | 'createdAt'>>): Result<Relation> {
    return this.entityGraph.updateRelation(id, updates);
  }

  getRelation(id: string): Relation | undefined {
    return this.entityGraph.getRelation(id);
  }

  addEvent(data: { name: string; description: string; timestamp?: Date; entities?: string[]; consequences?: string[]; probability?: number; metadata?: Record<string, unknown>; id?: string }): Result<Event> {
    if (this.timeline.getEventCount() >= this.config.maxEvents) {
      return err(new Error(`Maximum event count (${this.config.maxEvents}) reached`));
    }
    const event = createEvent(data);
    return this.timeline.addEvent(event);
  }

  removeEvent(id: string): Result<boolean> {
    return this.timeline.removeEvent(id);
  }

  addCausalLink(data: { causeEventId: string; effectEventId: string; strength?: number; delay?: number; description?: string; metadata?: Record<string, unknown>; id?: string }): Result<CausalLink> {
    const link = createCausalLink(data);
    return this.timeline.addCausalLink(link);
  }

  addConstraint(data: { name: string; type: ConstraintType; expression: string; description?: string; priority?: number; enabled?: boolean; metadata?: Record<string, unknown>; id?: string }): Result<Constraint> {
    if (this.constraintMap.getConstraintCount() >= this.config.maxConstraints) {
      return err(new Error(`Maximum constraint count (${this.config.maxConstraints}) reached`));
    }
    const constraint = createConstraint(data);
    return this.constraintMap.addConstraint(constraint);
  }

  removeConstraint(id: string): Result<boolean> {
    return this.constraintMap.removeConstraint(id);
  }

  addGoal(data: { name: string; description: string; priority?: GoalPriority; state?: GoalState; constraints?: string[]; subGoals?: string[]; progress?: number; deadline?: Date; metadata?: Record<string, unknown>; id?: string }): Result<Goal> {
    if (this.goalStack.getGoalCount() >= this.config.maxGoals) {
      return err(new Error(`Maximum goal count (${this.config.maxGoals}) reached`));
    }
    const goal = createGoal(data);
    return this.goalStack.pushGoal(goal);
  }

  removeGoal(id: string): Result<boolean> {
    const result = this.goalStack.updateGoalState(id, 'failed');
    if (!result.ok) return err(result.err);
    return ok(true);
  }

  queryEntitiesByType(type: EntityType): Entity[] {
    return this.entityGraph.queryByType(type);
  }

  queryRelationsByType(type: RelationType, entityId?: string): Relation[] {
    return this.entityGraph.queryByRelation(type, entityId);
  }

  queryTimeline(options?: { startTime?: Date; endTime?: Date; entityIds?: string[]; minProbability?: number; limit?: number }): Event[] {
    return this.timeline.queryByTime(options);
  }

  getCausalChain(eventId: string, direction: 'forward' | 'backward' | 'both' = 'forward', maxDepth?: number): CausalChainResult {
    return this.timeline.getCausalChain(eventId, direction, maxDepth);
  }

  predictConsequences(eventId: string, depth?: number): Array<{ event: Event; probability: number; path: string[] }> {
    return this.timeline.predictConsequence(eventId, depth);
  }

  detectPatterns(minOccurrences?: number, windowMs?: number): PatternDetectionResult[] {
    return this.timeline.detectPatterns(minOccurrences, windowMs);
  }

  checkConstraints(context: Record<string, unknown>): ConstraintViolation[] {
    return this.constraintMap.checkViolation(context);
  }

  resolveConflicts(violations: ConstraintViolation[]): ConflictResolution {
    return this.constraintMap.resolveConflict(violations);
  }

  decomposeGoal(goalId: string): Result<GoalDecomposition> {
    return this.goalStack.decompose(goalId);
  }

  prioritizeGoals(): Goal[] {
    return this.goalStack.prioritize();
  }

  checkGoalDependencies(goalId: string): { met: boolean; pending: string[] } {
    return this.goalStack.checkDependency(goalId);
  }

  traverseGraph(startId: string, options?: { maxDepth?: number; direction?: 'outgoing' | 'incoming' | 'both'; relationTypes?: string[] }): Entity[] {
    return this.entityGraph.traverse(startId, {
      maxDepth: options?.maxDepth ?? 10,
      direction: options?.direction ?? 'both',
      includeInactive: false,
      relationTypes: options?.relationTypes,
    });
  }

  findPath(fromId: string, toId: string, options?: { relationTypes?: string[]; maxDepth?: number }): PathResult | null {
    return this.entityGraph.shortestPath(fromId, toId, options);
  }

  getSubgraph(entityIds: string[], includeRelations?: boolean): SubgraphResult {
    return this.entityGraph.subgraph(entityIds, { includeRelations: includeRelations ?? true });
  }

  getRelatedEntities(entityId: string, direction?: 'outgoing' | 'incoming' | 'both'): Entity[] {
    return this.entityGraph.getRelatedEntities(entityId, direction ?? 'both');
  }

  diffWith(other: WorldModelEngine): GraphDiffResult {
    return this.entityGraph.diff(other.entityGraph);
  }

  mergeFrom(other: WorldModelEngine, conflictStrategy?: 'ours' | 'theirs' | 'merge' | 'latest'): Result<number> {
    return this.entityGraph.merge(other.entityGraph, {
      conflictStrategy: conflictStrategy ?? 'ours',
      mergeRelations: true,
      mergeAttributes: true,
    });
  }

  getStats(): GraphStatsResult {
    return this.graphStats.compute();
  }

  searchEntities(query: string, options?: { fuzzy?: boolean; limit?: number }): Entity[] {
    return this.graphQuery.searchByName(query, options);
  }

  searchByAttribute(key: string, value: unknown): string[] {
    return this.graphIndex.searchByAttribute(key, value);
  }

  createSnapshot(label?: string): string {
    const id = label ?? `snapshot_${this.version}_${Date.now()}`;
    const state: WorldModelState = {
      entityGraph: {
        entities: this.entityGraph.getAllEntities(),
        relations: this.entityGraph.getAllRelations(),
        adjacency: new Map(),
      },
      timeline: {
        id: this.timeline.getId(),
        name: this.timeline.getName(),
        events: this.timeline.getAllEvents(),
        causalLinks: this.timeline.getAllCausalLinks(),
        startTime: this.timeline.getStartTime() ?? new Date(),
        endTime: this.timeline.getEndTime() ?? new Date(),
        metadata: {},
      },
      constraints: {
        constraints: new Map(this.constraintMap.getAllConstraints().map((c) => [c.id, c])),
        activeConstraints: new Set(this.constraintMap.getActiveConstraints().map((c) => c.id)),
        violatedConstraints: new Set(this.constraintMap.getViolatedConstraints().map((c) => c.id)),
      },
      goals: {
        goals: new Map(this.goalStack.getAllGoals().map((g) => [g.id, g])),
        activeGoals: new Set(this.goalStack.getActiveGoals().map((g) => g.id)),
        completedGoals: new Set(this.goalStack.getCompletedGoals().map((g) => g.id)),
        failedGoals: new Set(this.goalStack.getFailedGoals().map((g) => g.id)),
      },
      version: this.version,
      timestamp: new Date(),
    };
    this.snapshots.set(id, state);
    logger.info(`Created snapshot: ${id}`);
    return id;
  }

  restoreSnapshot(id: string): Result<boolean> {
    const state = this.snapshots.get(id);
    if (!state) {
      return err(new Error(`Snapshot ${id} not found`));
    }
    this.entityGraph.clear();
    this.timeline.clear();
    this.constraintMap.clear();
    this.goalStack.clear();
    for (const [, entity] of state.entityGraph.entities) {
      this.entityGraph.addEntity(entity);
    }
    for (const [, relation] of state.entityGraph.relations) {
      this.entityGraph.addRelation(relation);
    }
    for (const event of state.timeline.events) {
      this.timeline.addEvent(event);
    }
    for (const link of state.timeline.causalLinks) {
      this.timeline.addCausalLink(link);
    }
    for (const [, constraint] of state.constraints.constraints) {
      this.constraintMap.addConstraint(constraint);
    }
    for (const [, goal] of state.goals.goals) {
      this.goalStack.pushGoal(goal);
    }
    this.version = state.version;
    logger.info(`Restored snapshot: ${id}`);
    return ok(true);
  }

  async save(key: string): Promise<Result<boolean>> {
    return this.graphPersistence.save(key, this.entityGraph, this.timeline, this.constraintMap, this.goalStack, this.version);
  }

  async load(key: string): Promise<Result<boolean>> {
    const result = await this.graphPersistence.load(key);
    if (!result.ok) return err(result.err);
    const data = result.value;
    this.entityGraph.clear();
    this.timeline.clear();
    this.constraintMap.clear();
    this.goalStack.clear();
    for (const entityData of data.entities) {
      const entity: Entity = {
        ...entityData,
        createdAt: new Date(entityData.createdAt),
        updatedAt: new Date((entityData as Record<string, unknown>).updatedAt as string),
      } as Entity;
      this.entityGraph.addEntity(entity);
    }
    for (const relationData of data.relations) {
      const relation: Relation = {
        ...relationData,
        createdAt: new Date(relationData.createdAt),
      } as Relation;
      this.entityGraph.addRelation(relation);
    }
    for (const eventData of data.events) {
      this.timeline.addEvent({
        ...eventData,
        timestamp: new Date(eventData.timestamp),
      } as Omit<Event, 'id'> & { id?: string });
    }
    for (const linkData of data.causalLinks) {
      this.timeline.addCausalLink(linkData as Omit<CausalLink, 'id'> & { id?: string });
    }
    for (const constraintData of data.constraints) {
      this.constraintMap.addConstraint(constraintData as Omit<Constraint, 'id'> & { id?: string });
    }
    for (const goalData of data.goals) {
      const goal: Goal = {
        ...goalData,
        deadline: goalData.deadline ? new Date(goalData.deadline) : undefined,
        createdAt: new Date(goalData.createdAt),
        updatedAt: new Date((goalData as Record<string, unknown>).updatedAt as string),
      } as Goal;
      this.goalStack.pushGoal(goal);
    }
    this.version = data.version;
    logger.info(`Loaded world model from key: ${key}`);
    return ok(true);
  }

  serialize(): Result<string> {
    return this.graphSerializer.serialize(this.entityGraph, this.timeline, this.constraintMap, this.goalStack, this.version);
  }

  deserialize(json: string): Result<boolean> {
    const result = this.graphSerializer.deserialize(json);
    if (!result.ok) return err(result.err);
    const data = result.value;
    this.entityGraph.clear();
    this.timeline.clear();
    this.constraintMap.clear();
    this.goalStack.clear();
    for (const entity of data.entities) {
      this.entityGraph.addEntity(entity);
    }
    for (const relation of data.relations) {
      this.entityGraph.addRelation(relation);
    }
    for (const event of data.events) {
      this.timeline.addEvent(event);
    }
    for (const link of data.causalLinks) {
      this.timeline.addCausalLink(link);
    }
    for (const constraint of data.constraints) {
      this.constraintMap.addConstraint(constraint);
    }
    for (const goal of data.goals) {
      this.goalStack.pushGoal(goal);
    }
    this.version = data.version;
    return ok(true);
  }

  getState(): WorldModelState {
    return {
      entityGraph: {
        entities: this.entityGraph.getAllEntities(),
        relations: this.entityGraph.getAllRelations(),
        adjacency: new Map(),
      },
      timeline: {
        id: this.timeline.getId(),
        name: this.timeline.getName(),
        events: this.timeline.getAllEvents(),
        causalLinks: this.timeline.getAllCausalLinks(),
        startTime: this.timeline.getStartTime() ?? new Date(),
        endTime: this.timeline.getEndTime() ?? new Date(),
        metadata: {},
      },
      constraints: {
        constraints: new Map(this.constraintMap.getAllConstraints().map((c) => [c.id, c])),
        activeConstraints: new Set(this.constraintMap.getActiveConstraints().map((c) => c.id)),
        violatedConstraints: new Set(this.constraintMap.getViolatedConstraints().map((c) => c.id)),
      },
      goals: {
        goals: new Map(this.goalStack.getAllGoals().map((g) => [g.id, g])),
        activeGoals: new Set(this.goalStack.getActiveGoals().map((g) => g.id)),
        completedGoals: new Set(this.goalStack.getCompletedGoals().map((g) => g.id)),
        failedGoals: new Set(this.goalStack.getFailedGoals().map((g) => g.id)),
      },
      version: this.version,
      timestamp: new Date(),
    };
  }

  getVersion(): number {
    return this.version;
  }

  getEntityCount(): number {
    return this.entityGraph.getEntityCount();
  }

  getRelationCount(): number {
    return this.entityGraph.getRelationCount();
  }

  getEventCount(): number {
    return this.timeline.getEventCount();
  }

  getConstraintCount(): number {
    return this.constraintMap.getConstraintCount();
  }

  getGoalCount(): number {
    return this.goalStack.getGoalCount();
  }

  getActiveGoals(): Goal[] {
    return this.goalStack.getActiveGoals();
  }

  getOverdueGoals(): Goal[] {
    return this.goalStack.getAllGoals().filter(isGoalOverdue);
  }

  getGoalUrgency(goalId: string): number {
    const goal = this.goalStack.getGoal(goalId);
    if (!goal) return 0;
    return getGoalUrgency(goal);
  }

  clear(): void {
    this.entityGraph.clear();
    this.timeline.clear();
    this.constraintMap.clear();
    this.goalStack.clear();
    this.version = 0;
    this.snapshots.clear();
    this.graphIndex.invalidate();
    logger.info('WorldModelEngine cleared');
  }

  getEntityGraph(): EntityGraph {
    return this.entityGraph;
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

  getGraphQuery(): GraphQuery {
    return this.graphQuery;
  }

  getGraphIndex(): GraphIndex {
    return this.graphIndex;
  }
}
