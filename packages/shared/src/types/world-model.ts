export type EntityType =
  | 'person'
  | 'organization'
  | 'location'
  | 'event'
  | 'concept'
  | 'resource'
  | 'artifact'
  | 'system';

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  description: string;
  attributes: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type RelationType =
  | 'depends_on'
  | 'influences'
  | 'conflicts_with'
  | 'supports'
  | 'requires'
  | 'produces'
  | 'consumes'
  | 'contains'
  | 'belongs_to'
  | 'interacts_with';

export interface Relation {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  strength: number;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface Event {
  id: string;
  name: string;
  description: string;
  timestamp: Date;
  entities: string[];
  consequences: string[];
  probability: number;
  metadata: Record<string, unknown>;
}

export interface CausalLink {
  id: string;
  causeEventId: string;
  effectEventId: string;
  strength: number;
  delay: number;
  description: string;
  metadata: Record<string, unknown>;
}

export type ConstraintType =
  | 'hard'
  | 'soft'
  | 'temporal'
  | 'resource'
  | 'logical'
  | 'domain';

export interface Constraint {
  id: string;
  name: string;
  type: ConstraintType;
  expression: string;
  description: string;
  priority: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
}

export type GoalPriority = 'critical' | 'high' | 'medium' | 'low';

export type GoalState = 'pending' | 'active' | 'completed' | 'failed' | 'deferred';

export interface Goal {
  id: string;
  name: string;
  description: string;
  priority: GoalPriority;
  state: GoalState;
  constraints: string[];
  subGoals: string[];
  progress: number;
  deadline?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EntityGraph {
  entities: Map<string, Entity>;
  relations: Map<string, Relation>;
  adjacency: Map<string, Set<string>>;
}

export interface Timeline {
  id: string;
  name: string;
  events: Event[];
  causalLinks: CausalLink[];
  startTime: Date;
  endTime: Date;
  metadata: Record<string, unknown>;
}

export interface ConstraintMap {
  constraints: Map<string, Constraint>;
  activeConstraints: Set<string>;
  violatedConstraints: Set<string>;
}

export interface GoalStack {
  goals: Map<string, Goal>;
  activeGoals: Set<string>;
  completedGoals: Set<string>;
  failedGoals: Set<string>;
}

export interface WorldModelState {
  entityGraph: EntityGraph;
  timeline: Timeline;
  constraints: ConstraintMap;
  goals: GoalStack;
  version: number;
  timestamp: Date;
}
