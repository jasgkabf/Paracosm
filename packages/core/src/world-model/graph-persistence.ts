import { mkdir, readFile, writeFile, unlink, readdir, stat, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import type { EntityRecord, RelationRecord, PersistenceSchema, EventRecord, ConstraintRecord, GoalRecord } from "./types.js";
import { CURRENT_PERSISTENCE_VERSION } from "./types.js";
import { Entity } from "./entity.js";
import { Relation } from "./relation.js";
import { Event } from "./event.js";
import { Constraint } from "./constraint.js";
import { Goal } from "./goal.js";

interface PersistedData {
  version: number;
  entities: Record<string, unknown>[];
  relations: Record<string, unknown>[];
  events: Record<string, unknown>[];
  constraints: Record<string, unknown>[];
  goals: Record<string, unknown>[];
  causalLinks: Array<{ causeId: string; effectId: string; strength: number; delay: number }>;
  metadata: {
    savedAt: string;
    entityCount: number;
    relationCount: number;
    eventCount: number;
  };
}

const SCHEMA_V1: PersistenceSchema = {
  version: 1,
  tables: ["entities", "relations", "events", "constraints", "goals", "causal_links", "metadata"],
  indexes: ["idx_entity_type", "idx_relation_type", "idx_event_entity", "idx_constraint_scope", "idx_goal_state"],
};

export class GraphPersistence {
  private basePath: string;
  private schema: PersistenceSchema;
  private dirty: boolean;
  private lastCheckpoint: string | null;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.schema = SCHEMA_V1;
    this.dirty = false;
    this.lastCheckpoint = null;
  }

  async save(
    entities: Map<string, EntityRecord>,
    relations: Map<string, RelationRecord>,
    events: Map<string, EventRecord>,
    constraints: Map<string, ConstraintRecord>,
    goals: Map<string, GoalRecord>,
    causalLinks: Array<{ causeId: string; effectId: string; strength: number; delay: number }>
  ): Promise<Result<true, ValidationError>> {
    try {
      await mkdir(this.basePath, { recursive: true });

      const data: PersistedData = {
        version: CURRENT_PERSISTENCE_VERSION,
        entities: Array.from(entities.values()).map((e) => Entity.serialize(e)),
        relations: Array.from(relations.values()).map((r) => Relation.serialize(r)),
        events: Array.from(events.values()).map((e) => Event.serialize(e)),
        constraints: Array.from(constraints.values()).map((c) => Constraint.serialize(c)),
        goals: Array.from(goals.values()).map((g) => Goal.serialize(g)),
        causalLinks,
        metadata: {
          savedAt: new Date().toISOString(),
          entityCount: entities.size,
          relationCount: relations.size,
          eventCount: events.size,
        },
      };

      const jsonStr = JSON.stringify(data, null, 0);
      const dataPath = join(this.basePath, "world-model.json");
      await writeFile(dataPath, jsonStr, "utf8");

      this.dirty = false;
      this.lastCheckpoint = data.metadata.savedAt;

      return ok(true);
    } catch (error) {
      return err(new ValidationError("Failed to save world model", {
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  async load(): Promise<Result<{
    entities: Map<string, EntityRecord>;
    relations: Map<string, RelationRecord>;
    events: Map<string, EventRecord>;
    constraints: Map<string, ConstraintRecord>;
    goals: Map<string, GoalRecord>;
    causalLinks: Array<{ causeId: string; effectId: string; strength: number; delay: number }>;
  }, ValidationError>> {
    try {
      const dataPath = join(this.basePath, "world-model.json");
      const content = await readFile(dataPath, "utf8");
      const data: PersistedData = JSON.parse(content);

      if (data.version !== CURRENT_PERSISTENCE_VERSION) {
        const migrated = this.migrateData(data);
        if (!migrated.ok) return migrated;
        Object.assign(data, migrated.value);
      }

      const entities = new Map<string, EntityRecord>();
      for (const entityData of data.entities) {
        const result = Entity.deserialize(entityData);
        if (result.ok) {
          entities.set(result.value.id, result.value);
        }
      }

      const relations = new Map<string, RelationRecord>();
      for (const relationData of data.relations) {
        const result = Relation.deserialize(relationData);
        if (result.ok) {
          relations.set(result.value.id, result.value);
        }
      }

      const events = new Map<string, EventRecord>();
      for (const eventData of data.events) {
        const result = Event.deserialize(eventData);
        if (result.ok) {
          events.set(result.value.id, result.value);
        }
      }

      const constraints = new Map<string, ConstraintRecord>();
      for (const constraintData of data.constraints) {
        const result = Constraint.deserialize(constraintData);
        if (result.ok) {
          constraints.set(result.value.id, result.value);
        }
      }

      const goals = new Map<string, GoalRecord>();
      for (const goalData of data.goals) {
        const result = Goal.deserialize(goalData);
        if (result.ok) {
          goals.set(result.value.id, result.value);
        }
      }

      return ok({
        entities,
        relations,
        events,
        constraints,
        goals,
        causalLinks: data.causalLinks ?? [],
      });
    } catch (error) {
      return err(new ValidationError("Failed to load world model", {
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  async checkpoint(
    entities: Map<string, EntityRecord>,
    relations: Map<string, RelationRecord>,
    events: Map<string, EventRecord>,
    constraints: Map<string, ConstraintRecord>,
    goals: Map<string, GoalRecord>,
    causalLinks: Array<{ causeId: string; effectId: string; strength: number; delay: number }>
  ): Promise<Result<true, ValidationError>> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const checkpointDir = join(this.basePath, "checkpoints");
    const checkpointPath = join(checkpointDir, `checkpoint-${timestamp}.json`);

    try {
      await mkdir(checkpointDir, { recursive: true });

      const data: PersistedData = {
        version: CURRENT_PERSISTENCE_VERSION,
        entities: Array.from(entities.values()).map((e) => Entity.serialize(e)),
        relations: Array.from(relations.values()).map((r) => Relation.serialize(r)),
        events: Array.from(events.values()).map((e) => Event.serialize(e)),
        constraints: Array.from(constraints.values()).map((c) => Constraint.serialize(c)),
        goals: Array.from(goals.values()).map((g) => Goal.serialize(g)),
        causalLinks,
        metadata: {
          savedAt: new Date().toISOString(),
          entityCount: entities.size,
          relationCount: relations.size,
          eventCount: events.size,
        },
      };

      const jsonStr = JSON.stringify(data, null, 0);
      await writeFile(checkpointPath, jsonStr, "utf8");

      this.lastCheckpoint = data.metadata.savedAt;

      return ok(true);
    } catch (error) {
      return err(new ValidationError("Failed to create checkpoint", {
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  async migrate(data: PersistedData): Promise<Result<PersistedData, ValidationError>> {
    return this.migrateData(data);
  }

  async compact(
    entities: Map<string, EntityRecord>,
    relations: Map<string, RelationRecord>,
    events: Map<string, EventRecord>,
    constraints: Map<string, ConstraintRecord>,
    goals: Map<string, GoalRecord>,
    causalLinks: Array<{ causeId: string; effectId: string; strength: number; delay: number }>
  ): Promise<Result<true, ValidationError>> {
    const validEntityIds = new Set(entities.keys());
    const validRelationIds = new Set(relations.keys());

    const compactedRelations = new Map<string, RelationRecord>();
    for (const [id, relation] of relations) {
      if (validEntityIds.has(relation.sourceId) && validEntityIds.has(relation.targetId)) {
        compactedRelations.set(id, relation);
      }
    }

    const compactedEvents = new Map<string, EventRecord>();
    for (const [id, event] of events) {
      if (validEntityIds.has(event.entityId)) {
        const compactedEvent = Event.clone(event);
        compactedEvent.causeIds = new Set(
          Array.from(event.causeIds).filter((cid) => events.has(cid))
        );
        compactedEvent.effectIds = new Set(
          Array.from(event.effectIds).filter((eid) => events.has(eid))
        );
        compactedEvents.set(id, compactedEvent);
      }
    }

    const compactedConstraints = new Map<string, ConstraintRecord>();
    for (const [id, constraint] of constraints) {
      const compactedScope = new Set(
        Array.from(constraint.scope).filter((eid) => validEntityIds.has(eid))
      );
      compactedConstraints.set(id, { ...constraint, scope: compactedScope });
    }

    const compactedGoals = new Map<string, GoalRecord>();
    for (const [id, goal] of goals) {
      if (goal.parentGoalId && !goals.has(goal.parentGoalId)) {
        const updated = Goal.clone(goal);
        updated.parentGoalId = null;
        compactedGoals.set(id, updated);
      } else {
        compactedGoals.set(id, goal);
      }
    }

    const compactedLinks = causalLinks.filter(
      (link) => compactedEvents.has(link.causeId) && compactedEvents.has(link.effectId)
    );

    return this.save(compactedEntities(entities), compactedRelations, compactedEvents, compactedConstraints, compactedGoals, compactedLinks);
  }

  async backup(backupPath: string): Promise<Result<true, ValidationError>> {
    try {
      const sourcePath = join(this.basePath, "world-model.json");
      await mkdir(dirname(backupPath), { recursive: true });
      await copyFile(sourcePath, backupPath);
      return ok(true);
    } catch (error) {
      return err(new ValidationError("Failed to create backup", {
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  async restore(backupPath: string): Promise<Result<true, ValidationError>> {
    try {
      const destPath = join(this.basePath, "world-model.json");
      await mkdir(this.basePath, { recursive: true });
      await copyFile(backupPath, destPath);
      this.dirty = true;
      return ok(true);
    } catch (error) {
      return err(new ValidationError("Failed to restore from backup", {
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  getSchema(): PersistenceSchema {
    return { ...this.schema };
  }

  getLastCheckpoint(): string | null {
    return this.lastCheckpoint;
  }

  isDirty(): boolean {
    return this.dirty;
  }

  async listCheckpoints(): Promise<string[]> {
    const checkpointDir = join(this.basePath, "checkpoints");
    try {
      const files = await readdir(checkpointDir);
      return files
        .filter((f) => f.startsWith("checkpoint-") && f.endsWith(".json"))
        .sort()
        .reverse();
    } catch {
      return [];
    }
  }

  private migrateData(data: PersistedData): Result<PersistedData, ValidationError> {
    let current = { ...data };

    while (current.version < CURRENT_PERSISTENCE_VERSION) {
      const nextVersion = current.version + 1;

      switch (nextVersion) {
        case 1:
          current = this.migrateToV1(current);
          break;
        default:
          return err(new ValidationError(`Unknown migration target version: ${nextVersion}`, {
            currentVersion: current.version,
            targetVersion: nextVersion,
          }));
      }
    }

    return ok(current);
  }

  private migrateToV1(data: PersistedData): PersistedData {
    const migrated = { ...data, version: 1 };

    if (!migrated.entities) migrated.entities = [];
    if (!migrated.relations) migrated.relations = [];
    if (!migrated.events) migrated.events = [];
    if (!migrated.constraints) migrated.constraints = [];
    if (!migrated.goals) migrated.goals = [];
    if (!migrated.causalLinks) migrated.causalLinks = [];
    if (!migrated.metadata) {
      migrated.metadata = {
        savedAt: new Date().toISOString(),
        entityCount: migrated.entities.length,
        relationCount: migrated.relations.length,
        eventCount: migrated.events.length,
      };
    }

    return migrated;
  }
}

function compactedEntities(entities: Map<string, EntityRecord>): Map<string, EntityRecord> {
  const result = new Map<string, EntityRecord>();
  for (const [id, entity] of entities) {
    const cleaned = Entity.clone(entity);
    cleaned.childIds = new Set(
      Array.from(entity.childIds).filter((cid) => entities.has(cid))
    );
    if (cleaned.parentId && !entities.has(cleaned.parentId)) {
      cleaned.parentId = null;
    }
    result.set(id, cleaned);
  }
  return result;
}
