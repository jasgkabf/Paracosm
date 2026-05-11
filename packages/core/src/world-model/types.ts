import type {
  EntityId,
  RelationId,
  EventId,
  ConstraintId,
  GoalId,
  EntityType,
  RelationType,
  EventSeverity,
  ConstraintType,
  ConstraintStatus,
  GoalPriority,
  GoalState,
} from "@paracosm/shared";

export interface GraphNode {
  id: string;
  type: EntityType;
  label: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  label: string;
  weight: number;
  bidirectional: boolean;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GraphData {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  adjacency: Map<string, Set<string>>;
  reverseAdjacency: Map<string, Set<string>>;
  edgeIndex: Map<string, string[]>;
  reverseEdgeIndex: Map<string, string[]>;
}

export interface EntityRecord {
  id: string;
  entityType: EntityType;
  name: string;
  description: string;
  properties: Map<string, unknown>;
  tags: Set<string>;
  metadata: Record<string, unknown>;
  parentId: string | null;
  childIds: Set<string>;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface RelationRecord {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  label: string;
  weight: number;
  bidirectional: boolean;
  properties: Map<string, unknown>;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface EventRecord {
  id: string;
  name: string;
  description: string;
  timestamp: string;
  severity: EventSeverity;
  entityId: string;
  payload: Record<string, unknown>;
  duration: number | null;
  causeIds: Set<string>;
  effectIds: Set<string>;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ConstraintRecord {
  id: string;
  name: string;
  constraintType: ConstraintType;
  status: ConstraintStatus;
  description: string;
  expression: string;
  priority: number;
  penalty: number;
  scope: Set<string>;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface GoalRecord {
  id: string;
  name: string;
  description: string;
  priority: GoalPriority;
  state: GoalState;
  parentGoalId: string | null;
  subGoalIds: Set<string>;
  constraintIds: Set<string>;
  successCriteria: string;
  progress: number;
  deadline: string | null;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface WorldModelConfig {
  maxEntities: number;
  maxRelations: number;
  maxEvents: number;
  maxConstraints: number;
  maxGoals: number;
  autoIndex: boolean;
  persistenceEnabled: boolean;
  persistencePath: string;
  checkpointIntervalMs: number;
  enableHistory: boolean;
  maxHistorySize: number;
}

export const DEFAULT_WORLD_MODEL_CONFIG: WorldModelConfig = {
  maxEntities: 100000,
  maxRelations: 500000,
  maxEvents: 1000000,
  maxConstraints: 10000,
  maxGoals: 10000,
  autoIndex: true,
  persistenceEnabled: false,
  persistencePath: "./data/world-model",
  checkpointIntervalMs: 60000,
  enableHistory: true,
  maxHistorySize: 1000,
};

export type WorldModelEventName =
  | "entity:added"
  | "entity:removed"
  | "entity:updated"
  | "relation:added"
  | "relation:removed"
  | "relation:updated"
  | "event:added"
  | "event:removed"
  | "constraint:added"
  | "constraint:removed"
  | "constraint:violated"
  | "constraint:satisfied"
  | "goal:added"
  | "goal:removed"
  | "goal:updated"
  | "goal:resolved"
  | "goal:failed"
  | "graph:changed"
  | "snapshot:created"
  | "snapshot:restored"
  | "engine:initialized"
  | "engine:shutdown";

export interface WorldModelEvent {
  type: WorldModelEventName;
  timestamp: string;
  data: Record<string, unknown>;
}

export type WorldModelEventHandler = (event: WorldModelEvent) => void;

export interface WorldModelEvents {
  on(event: WorldModelEventName, handler: WorldModelEventHandler): void;
  off(event: WorldModelEventName, handler: WorldModelEventHandler): void;
  emit(event: WorldModelEvent): void;
}

export interface TraversalOptions {
  maxDepth: number;
  direction: "outgoing" | "incoming" | "both";
  edgeFilter?: (edge: GraphEdge) => boolean;
  nodeFilter?: (node: GraphNode) => boolean;
}

export interface QueryPattern {
  nodeType?: EntityType;
  edgeType?: RelationType;
  properties?: Record<string, unknown>;
  tags?: string[];
}

export interface GraphDiff {
  addedNodes: GraphNode[];
  removedNodes: string[];
  modifiedNodes: Array<{ id: string; before: GraphNode; after: GraphNode }>;
  addedEdges: GraphEdge[];
  removedEdges: string[];
  modifiedEdges: Array<{ id: string; before: GraphEdge; after: GraphEdge }>;
}

export interface GraphSnapshot {
  id: string;
  timestamp: string;
  version: number;
  checksum: string;
  data: GraphData;
}

export type Cardinality = "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";

export interface RelationRule {
  type: RelationType;
  cardinality: Cardinality;
  bidirectional: boolean;
  transitive: boolean;
  allowedSourceTypes: EntityType[];
  allowedTargetTypes: EntityType[];
}

export interface CausalChain {
  events: EventRecord[];
  links: Array<{ causeId: string; effectId: string; strength: number; delay: number }>;
}

export interface EventPattern {
  id: string;
  name: string;
  eventTypes: string[];
  frequency: number;
  avgInterval: number;
  confidence: number;
}

export interface ConstraintConflict {
  constraintA: string;
  constraintB: string;
  description: string;
  severity: "low" | "medium" | "high";
}

export interface GoalDependency {
  goalId: string;
  dependsOn: string[];
  satisfied: boolean;
}

export interface PersistenceSchema {
  version: number;
  tables: string[];
  indexes: string[];
}

export const CURRENT_PERSISTENCE_VERSION = 1;

export const SERIALIZATION_VERSION = 1;

export interface SerializedGraph {
  version: number;
  nodes: Array<[string, GraphNode]>;
  edges: Array<[string, GraphEdge]>;
  metadata: {
    createdAt: string;
    entityCount: number;
    relationCount: number;
  };
}
