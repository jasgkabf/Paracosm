import type {
  Entity,
  Relation,
  Event,
  CausalLink,
  Constraint,
  Goal,
  WorldModelState,
  EntityGraph as EntityGraphType,
  Timeline as TimelineType,
  ConstraintMap as ConstraintMapType,
  GoalStack as GoalStackType,
} from '@paracosm/shared';

export interface WorldModelConfig {
  maxEntities: number;
  maxRelations: number;
  maxEvents: number;
  maxConstraints: number;
  maxGoals: number;
  autoVersion: boolean;
  persistChanges: boolean;
  persistencePath?: string;
}

export interface GraphTraversalOptions {
  maxDepth: number;
  direction: 'outgoing' | 'incoming' | 'both';
  relationTypes?: string[];
  includeInactive: boolean;
}

export interface GraphDiffResult {
  addedEntities: Entity[];
  removedEntities: Entity[];
  modifiedEntities: Array<{ before: Entity; after: Entity }>;
  addedRelations: Relation[];
  removedRelations: Relation[];
  modifiedRelations: Array<{ before: Relation; after: Relation }>;
}

export interface GraphMergeOptions {
  conflictStrategy: 'ours' | 'theirs' | 'merge' | 'latest';
  mergeRelations: boolean;
  mergeAttributes: boolean;
}

export interface GraphQueryOptions {
  entityTypes?: string[];
  relationTypes?: string[];
  attributeFilters?: Record<string, unknown>;
  depth?: number;
  limit?: number;
  offset?: number;
}

export interface GraphStatsResult {
  totalEntities: number;
  totalRelations: number;
  entitiesByType: Record<string, number>;
  relationsByType: Record<string, number>;
  averageConnectivity: number;
  maxConnectivity: number;
  minConnectivity: number;
  orphanEntities: number;
  stronglyConnectedComponents: number;
  diameter: number;
  density: number;
}

export interface PathResult {
  path: string[];
  length: number;
  weight: number;
  relationTypes: string[];
}

export interface SubgraphResult {
  entities: Entity[];
  relations: Relation[];
  boundaryEntities: string[];
}

export interface TimelineQueryOptions {
  startTime?: Date;
  endTime?: Date;
  entityIds?: string[];
  eventTypes?: string[];
  minProbability?: number;
  limit?: number;
}

export interface CausalChainResult {
  events: Event[];
  links: CausalLink[];
  totalStrength: number;
  totalDelay: number;
}

export interface PatternDetectionResult {
  pattern: string;
  occurrences: number;
  confidence: number;
  events: Event[][];
  description: string;
}

export interface ConstraintViolation {
  constraint: Constraint;
  violatingEntity?: Entity;
  violatingRelation?: Relation;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ConflictResolution {
  resolved: boolean;
  strategy: string;
  adjustments: Array<{
    entityId?: string;
    relationId?: string;
    changes: Record<string, unknown>;
  }>;
  message: string;
}

export interface GoalDecomposition {
  parentGoal: Goal;
  subGoals: Goal[];
  dependencies: Array<{ from: string; to: string; type: string }>;
  estimatedEffort: number;
}

export interface WorldModelEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

export const DEFAULT_WORLD_MODEL_CONFIG: WorldModelConfig = {
  maxEntities: 10000,
  maxRelations: 50000,
  maxEvents: 100000,
  maxConstraints: 1000,
  maxGoals: 500,
  autoVersion: true,
  persistChanges: false,
};

export interface SerializedWorldModel {
  version: number;
  timestamp: string;
  config: WorldModelConfig;
  entities: Array<ReturnType<EntityGraphType['entities']['get']> & { id: string }>;
  relations: Array<ReturnType<EntityGraphType['relations']['get']> & { id: string }>;
  events: Event[];
  causalLinks: CausalLink[];
  constraints: Array<ReturnType<ConstraintMapType['constraints']['get']> & { id: string }>;
  goals: Array<ReturnType<GoalStackType['goals']['get']> & { id: string }>;
}
