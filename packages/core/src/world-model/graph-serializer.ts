import type { Entity, Relation, Event, CausalLink, Constraint, Goal } from '@paracosm/shared';
import { EntityGraph } from './entity-graph.js';
import { Timeline } from './timeline.js';
import { ConstraintMap } from './constraint-map.js';
import { GoalStack } from './goal-stack.js';
import type { WorldModelConfig, GraphDiffResult } from './types.js';
import { DEFAULT_WORLD_MODEL_CONFIG } from './types.js';
import { ok, err, type Result } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('GraphSerializer');

export interface SerializedModel {
  version: number;
  timestamp: string;
  config: WorldModelConfig;
  entities: Array<SerializedEntity>;
  relations: Array<SerializedRelation>;
  events: Array<SerializedEvent>;
  causalLinks: Array<SerializedCausalLink>;
  constraints: Array<SerializedConstraint>;
  goals: Array<SerializedGoal>;
}

export interface SerializedEntity {
  id: string;
  name: string;
  type: string;
  description: string;
  attributes: string;
  metadata: string;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  strength: number;
  description: string;
  metadata: string;
  createdAt: string;
}

export interface SerializedEvent {
  id: string;
  name: string;
  description: string;
  timestamp: string;
  entities: string;
  consequences: string;
  probability: number;
  metadata: string;
}

export interface SerializedCausalLink {
  id: string;
  causeEventId: string;
  effectEventId: string;
  strength: number;
  delay: number;
  description: string;
  metadata: string;
}

export interface SerializedConstraint {
  id: string;
  name: string;
  type: string;
  expression: string;
  description: string;
  priority: number;
  enabled: boolean;
  metadata: string;
}

export interface SerializedGoal {
  id: string;
  name: string;
  description: string;
  priority: string;
  state: string;
  constraints: string;
  subGoals: string;
  progress: number;
  deadline?: string;
  metadata: string;
  createdAt: string;
  updatedAt: string;
}

export class GraphSerializer {
  private config: WorldModelConfig;

  constructor(config: WorldModelConfig = DEFAULT_WORLD_MODEL_CONFIG) {
    this.config = config;
  }

  serialize(
    entityGraph: EntityGraph,
    timeline: Timeline,
    constraintMap: ConstraintMap,
    goalStack: GoalStack,
    version: number,
  ): Result<string> {
    try {
      const model: SerializedModel = {
        version,
        timestamp: new Date().toISOString(),
        config: this.config,
        entities: Array.from(entityGraph.getAllEntities().values()).map(this.serializeEntity),
        relations: Array.from(entityGraph.getAllRelations().values()).map(this.serializeRelation),
        events: timeline.getAllEvents().map(this.serializeEvent),
        causalLinks: timeline.getAllCausalLinks().map(this.serializeCausalLink),
        constraints: constraintMap.getAllConstraints().map(this.serializeConstraint),
        goals: goalStack.getAllGoals().map(this.serializeGoal),
      };
      const json = JSON.stringify(model);
      logger.info(`Serialized world model: ${model.entities.length} entities, ${model.relations.length} relations`);
      return ok(json);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Serialization failed: ${message}`);
      return err(new Error(`Serialization failed: ${message}`));
    }
  }

  deserialize(json: string): Result<{
    entities: Entity[];
    relations: Relation[];
    events: Event[];
    causalLinks: CausalLink[];
    constraints: Constraint[];
    goals: Goal[];
    version: number;
    config: WorldModelConfig;
  }> {
    try {
      const model: SerializedModel = JSON.parse(json);
      const entities = model.entities.map(this.deserializeEntity);
      const relations = model.relations.map(this.deserializeRelation);
      const events = model.events.map(this.deserializeEvent);
      const causalLinks = model.causalLinks.map(this.deserializeCausalLink);
      const constraints = model.constraints.map(this.deserializeConstraint);
      const goals = model.goals.map(this.deserializeGoal);
      logger.info(`Deserialized world model: ${entities.length} entities, ${relations.length} relations`);
      return ok({
        entities,
        relations,
        events,
        causalLinks,
        constraints,
        goals,
        version: model.version,
        config: model.config,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Deserialization failed: ${message}`);
      return err(new Error(`Deserialization failed: ${message}`));
    }
  }

  private serializeEntity(entity: Entity): SerializedEntity {
    return {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      description: entity.description,
      attributes: JSON.stringify(entity.attributes),
      metadata: JSON.stringify(entity.metadata),
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private deserializeEntity(se: SerializedEntity): Entity {
    return {
      id: se.id,
      name: se.name,
      type: se.type as Entity['type'],
      description: se.description,
      attributes: JSON.parse(se.attributes),
      metadata: JSON.parse(se.metadata),
      createdAt: new Date(se.createdAt),
      updatedAt: new Date(se.updatedAt),
    };
  }

  private serializeRelation(relation: Relation): SerializedRelation {
    return {
      id: relation.id,
      sourceId: relation.sourceId,
      targetId: relation.targetId,
      type: relation.type,
      strength: relation.strength,
      description: relation.description,
      metadata: JSON.stringify(relation.metadata),
      createdAt: relation.createdAt.toISOString(),
    };
  }

  private deserializeRelation(sr: SerializedRelation): Relation {
    return {
      id: sr.id,
      sourceId: sr.sourceId,
      targetId: sr.targetId,
      type: sr.type as Relation['type'],
      strength: sr.strength,
      description: sr.description,
      metadata: JSON.parse(sr.metadata),
      createdAt: new Date(sr.createdAt),
    };
  }

  private serializeEvent(event: Event): SerializedEvent {
    return {
      id: event.id,
      name: event.name,
      description: event.description,
      timestamp: event.timestamp.toISOString(),
      entities: JSON.stringify(event.entities),
      consequences: JSON.stringify(event.consequences),
      probability: event.probability,
      metadata: JSON.stringify(event.metadata),
    };
  }

  private deserializeEvent(se: SerializedEvent): Event {
    return {
      id: se.id,
      name: se.name,
      description: se.description,
      timestamp: new Date(se.timestamp),
      entities: JSON.parse(se.entities),
      consequences: JSON.parse(se.consequences),
      probability: se.probability,
      metadata: JSON.parse(se.metadata),
    };
  }

  private serializeCausalLink(link: CausalLink): SerializedCausalLink {
    return {
      id: link.id,
      causeEventId: link.causeEventId,
      effectEventId: link.effectEventId,
      strength: link.strength,
      delay: link.delay,
      description: link.description,
      metadata: JSON.stringify(link.metadata),
    };
  }

  private deserializeCausalLink(sl: SerializedCausalLink): CausalLink {
    return {
      id: sl.id,
      causeEventId: sl.causeEventId,
      effectEventId: sl.effectEventId,
      strength: sl.strength,
      delay: sl.delay,
      description: sl.description,
      metadata: JSON.parse(sl.metadata),
    };
  }

  private serializeConstraint(constraint: Constraint): SerializedConstraint {
    return {
      id: constraint.id,
      name: constraint.name,
      type: constraint.type,
      expression: constraint.expression,
      description: constraint.description,
      priority: constraint.priority,
      enabled: constraint.enabled,
      metadata: JSON.stringify(constraint.metadata),
    };
  }

  private deserializeConstraint(sc: SerializedConstraint): Constraint {
    return {
      id: sc.id,
      name: sc.name,
      type: sc.type as Constraint['type'],
      expression: sc.expression,
      description: sc.description,
      priority: sc.priority,
      enabled: sc.enabled,
      metadata: JSON.parse(sc.metadata),
    };
  }

  private serializeGoal(goal: Goal): SerializedGoal {
    return {
      id: goal.id,
      name: goal.name,
      description: goal.description,
      priority: goal.priority,
      state: goal.state,
      constraints: JSON.stringify(goal.constraints),
      subGoals: JSON.stringify(goal.subGoals),
      progress: goal.progress,
      deadline: goal.deadline?.toISOString(),
      metadata: JSON.stringify(goal.metadata),
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    };
  }

  private deserializeGoal(sg: SerializedGoal): Goal {
    return {
      id: sg.id,
      name: sg.name,
      description: sg.description,
      priority: sg.priority as Goal['priority'],
      state: sg.state as Goal['state'],
      constraints: JSON.parse(sg.constraints),
      subGoals: JSON.parse(sg.subGoals),
      progress: sg.progress,
      deadline: sg.deadline ? new Date(sg.deadline) : undefined,
      metadata: JSON.parse(sg.metadata),
      createdAt: new Date(sg.createdAt),
      updatedAt: new Date(sg.updatedAt),
    };
  }
}
