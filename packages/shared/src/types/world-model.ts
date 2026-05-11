import type { Timestamped, Identified } from "./common.js";

export type EntityId = string & { readonly __brand: unique symbol };

export enum EntityType {
  Agent = "agent",
  Resource = "resource",
  Location = "location",
  Event = "event",
  Concept = "concept",
  Organization = "organization",
  Artifact = "artifact",
  Process = "process",
}

export interface EntityProperty {
  key: string;
  value: unknown;
  type: "string" | "number" | "boolean" | "object" | "array";
  mutable: boolean;
}

export interface Entity extends Identified, Timestamped {
  name: string;
  type: EntityType;
  description: string;
  properties: EntityProperty[];
  tags: string[];
  metadata: Record<string, unknown>;
  parentId: EntityId | null;
  childIds: EntityId[];
}

export type RelationId = string & { readonly __brand: unique symbol };

export enum RelationType {
  DependsOn = "depends_on",
  Influences = "influences",
  Contains = "contains",
  BelongsTo = "belongs_to",
  Precedes = "precedes",
  Enables = "enables",
  Inhibits = "inhibits",
  Transforms = "transforms",
  Communicates = "communicates",
  Competes = "competes",
}

export interface RelationProperty {
  key: string;
  value: unknown;
}

export interface Relation extends Identified, Timestamped {
  sourceId: EntityId;
  targetId: EntityId;
  type: RelationType;
  label: string;
  weight: number;
  properties: RelationProperty[];
  bidirectional: boolean;
}

export type EventId = string & { readonly __brand: unique symbol };

export enum EventSeverity {
  Info = "info",
  Warning = "warning",
  Critical = "critical",
}

export interface Event extends Identified, Timestamped {
  name: string;
  description: string;
  timestamp: string;
  severity: EventSeverity;
  entityId: EntityId;
  payload: Record<string, unknown>;
  duration: number | null;
}

export interface CausalLink {
  id: string;
  causeEventId: EventId;
  effectEventId: EventId;
  strength: number;
  delay: number;
  description: string;
}

export type ConstraintId = string & { readonly __brand: unique symbol };

export enum ConstraintType {
  Hard = "hard",
  Soft = "soft",
  Preference = "preference",
  Resource = "resource",
  Temporal = "temporal",
  Logical = "logical",
}

export enum ConstraintStatus {
  Active = "active",
  Violated = "violated",
  Satisfied = "satisfied",
  Relaxed = "relaxed",
}

export interface Constraint extends Identified, Timestamped {
  name: string;
  type: ConstraintType;
  status: ConstraintStatus;
  description: string;
  expression: string;
  priority: number;
  penalty: number;
  scope: EntityId[];
}

export type GoalId = string & { readonly __brand: unique symbol };

export enum GoalPriority {
  Critical = 0,
  High = 1,
  Medium = 2,
  Low = 3,
  Optional = 4,
}

export enum GoalState {
  Pending = "pending",
  Active = "active",
  InProgress = "in_progress",
  Completed = "completed",
  Failed = "failed",
  Deferred = "deferred",
  Cancelled = "cancelled",
}

export interface Goal extends Identified, Timestamped {
  name: string;
  description: string;
  priority: GoalPriority;
  state: GoalState;
  parentGoalId: GoalId | null;
  subGoalIds: GoalId[];
  constraints: ConstraintId[];
  successCriteria: string;
  progress: number;
  deadline: string | null;
  assignee: EntityId | null;
}

export interface EntityGraph {
  entities: Map<EntityId, Entity>;
  relations: Map<RelationId, Relation>;
  adjacency: Map<EntityId, RelationId[]>;
  reverseAdjacency: Map<EntityId, RelationId[]>;
}

export interface Timeline {
  events: Map<EventId, Event>;
  causalLinks: CausalLink[];
  startTime: string;
  endTime: string;
  resolution: number;
}

export interface ConstraintMap {
  constraints: Map<ConstraintId, Constraint>;
  entityConstraints: Map<EntityId, ConstraintId[]>;
  violatedConstraints: ConstraintId[];
}

export interface GoalStack {
  goals: Map<GoalId, Goal>;
  activeGoals: GoalId[];
  completedGoals: GoalId[];
  failedGoals: GoalId[];
}

export interface WorldModelState {
  entityGraph: EntityGraph;
  timeline: Timeline;
  constraintMap: ConstraintMap;
  goalStack: GoalStack;
  version: number;
  checksum: string;
}
