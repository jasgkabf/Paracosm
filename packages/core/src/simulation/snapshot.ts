import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import type {
  SnapshotDiff,
  CompressedSnapshot,
  SnapshotPatch,
} from "./types.js";

interface SnapshotEntity {
  id: string;
  type: string;
  name: string;
  properties: Map<string, unknown>;
  tags: Set<string>;
  parentId: string | null;
  childIds: Set<string>;
}

interface SnapshotRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  weight: number;
  bidirectional: boolean;
  properties: Map<string, unknown>;
}

interface SnapshotConstraint {
  id: string;
  name: string;
  type: string;
  status: string;
  expression: string;
  priority: number;
  scope: Set<string>;
}

interface SnapshotGoal {
  id: string;
  name: string;
  priority: number;
  state: string;
  progress: number;
  constraintIds: Set<string>;
  parentGoalId: string | null;
  subGoalIds: Set<string>;
}

interface SnapshotData {
  entities: Map<string, SnapshotEntity>;
  relations: Map<string, SnapshotRelation>;
  constraints: Map<string, SnapshotConstraint>;
  goals: Map<string, SnapshotGoal>;
  globalState: Record<string, unknown>;
  version: number;
  checksum: string;
}

interface GraphLike {
  getAllEntities(): Array<{ id: string; entityType: string; name: string; properties: Map<string, unknown>; tags: Set<string>; parentId: string | null; childIds: Set<string> }>;
  getAllRelations(): Array<{ id: string; sourceId: string; targetId: string; relationType: string; weight: number; bidirectional: boolean; properties: Map<string, unknown> }>;
  entityCount(): number;
  relationCount(): number;
  getVersion(): number;
}

interface ConstraintMapLike {
  getAllConstraints(): Array<{ id: string; name: string; constraintType: string; status: string; expression: string; priority: number; scope: Set<string> }>;
}

interface GoalStackLike {
  getAllGoals(): Array<{ id: string; name: string; priority: number; state: string; progress: number; constraintIds: Set<string>; parentGoalId: string | null; subGoalIds: Set<string> }>;
}

export class Snapshot {
  private data: SnapshotData;
  private id: string;
  private createdAt: string;

  private constructor(data: SnapshotData, id: string, createdAt: string) {
    this.data = data;
    this.id = id;
    this.createdAt = createdAt;
  }

  static create(graph: GraphLike, constraintMap?: ConstraintMapLike, goalStack?: GoalStackLike): Snapshot {
    const entities = new Map<string, SnapshotEntity>();
    const relations = new Map<string, SnapshotRelation>();
    const constraints = new Map<string, SnapshotConstraint>();
    const goals = new Map<string, SnapshotGoal>();

    for (const entity of graph.getAllEntities()) {
      entities.set(entity.id, {
        id: entity.id,
        type: entity.entityType,
        name: entity.name,
        properties: new Map(entity.properties),
        tags: new Set(entity.tags),
        parentId: entity.parentId,
        childIds: new Set(entity.childIds),
      });
    }

    for (const relation of graph.getAllRelations()) {
      relations.set(relation.id, {
        id: relation.id,
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        type: relation.relationType,
        weight: relation.weight,
        bidirectional: relation.bidirectional,
        properties: new Map(relation.properties),
      });
    }

    if (constraintMap) {
      for (const constraint of constraintMap.getAllConstraints()) {
        constraints.set(constraint.id, {
          id: constraint.id,
          name: constraint.name,
          type: constraint.constraintType,
          status: constraint.status,
          expression: constraint.expression,
          priority: constraint.priority,
          scope: new Set(constraint.scope),
        });
      }
    }

    if (goalStack) {
      for (const goal of goalStack.getAllGoals()) {
        goals.set(goal.id, {
          id: goal.id,
          name: goal.name,
          priority: goal.priority,
          state: goal.state,
          progress: goal.progress,
          constraintIds: new Set(goal.constraintIds),
          parentGoalId: goal.parentGoalId,
          subGoalIds: new Set(goal.subGoalIds),
        });
      }
    }

    const data: SnapshotData = {
      entities,
      relations,
      constraints,
      goals,
      globalState: {},
      version: graph.getVersion(),
      checksum: Snapshot.computeChecksum(entities, relations),
    };

    const id = `snap_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const createdAt = new Date().toISOString();

    return new Snapshot(data, id, createdAt);
  }

  clone(): Snapshot {
    const clonedData: SnapshotData = {
      entities: new Map(),
      relations: new Map(),
      constraints: new Map(),
      goals: new Map(),
      globalState: { ...this.data.globalState },
      version: this.data.version,
      checksum: this.data.checksum,
    };

    for (const [id, entity] of this.data.entities) {
      clonedData.entities.set(id, {
        ...entity,
        properties: new Map(entity.properties),
        tags: new Set(entity.tags),
        childIds: new Set(entity.childIds),
      });
    }

    for (const [id, relation] of this.data.relations) {
      clonedData.relations.set(id, {
        ...relation,
        properties: new Map(relation.properties),
      });
    }

    for (const [id, constraint] of this.data.constraints) {
      clonedData.constraints.set(id, {
        ...constraint,
        scope: new Set(constraint.scope),
      });
    }

    for (const [id, goal] of this.data.goals) {
      clonedData.goals.set(id, {
        ...goal,
        constraintIds: new Set(goal.constraintIds),
        subGoalIds: new Set(goal.subGoalIds),
      });
    }

    return new Snapshot(clonedData, `snap_${Date.now()}_clone`, new Date().toISOString());
  }

  diff(other: Snapshot): SnapshotDiff {
    const result: SnapshotDiff = {
      addedEntities: [],
      removedEntities: [],
      modifiedEntities: [],
      addedRelations: [],
      removedRelations: [],
      modifiedRelations: [],
      addedConstraints: [],
      removedConstraints: [],
      addedGoals: [],
      removedGoals: [],
      checksumDelta: "",
    };

    for (const [id, entity] of other.data.entities) {
      if (!this.data.entities.has(id)) {
        result.addedEntities.push(id);
      } else {
        const thisEntity = this.data.entities.get(id)!;
        const modifications = this.diffEntities(thisEntity, entity);
        result.modifiedEntities.push(...modifications);
      }
    }

    for (const [id] of this.data.entities) {
      if (!other.data.entities.has(id)) {
        result.removedEntities.push(id);
      }
    }

    for (const [id, relation] of other.data.relations) {
      if (!this.data.relations.has(id)) {
        result.addedRelations.push(id);
      } else {
        const thisRelation = this.data.relations.get(id)!;
        const modifications = this.diffRelations(thisRelation, relation);
        result.modifiedRelations.push(...modifications);
      }
    }

    for (const [id] of this.data.relations) {
      if (!other.data.relations.has(id)) {
        result.removedRelations.push(id);
      }
    }

    for (const [id] of other.data.constraints) {
      if (!this.data.constraints.has(id)) {
        result.addedConstraints.push(id);
      }
    }

    for (const [id] of this.data.constraints) {
      if (!other.data.constraints.has(id)) {
        result.removedConstraints.push(id);
      }
    }

    for (const [id] of other.data.goals) {
      if (!this.data.goals.has(id)) {
        result.addedGoals.push(id);
      }
    }

    for (const [id] of this.data.goals) {
      if (!other.data.goals.has(id)) {
        result.removedGoals.push(id);
      }
    }

    result.checksumDelta = Snapshot.computeChecksumDelta(this.data.checksum, other.data.checksum);

    return result;
  }

  applyPatch(patch: SnapshotPatch): Result<true, ValidationError> {
    const diff = patch.diffs;

    for (const entityId of diff.removedEntities) {
      this.data.entities.delete(entityId);
    }

    for (const entityId of diff.addedEntities) {
      const sourceSnapshot = this.findEntityInPatch(patch, entityId);
      if (sourceSnapshot) {
        this.data.entities.set(entityId, sourceSnapshot);
      }
    }

    for (const mod of diff.modifiedEntities) {
      const entity = this.data.entities.get(mod.id);
      if (entity) {
        (entity as any)[mod.field] = mod.after;
      }
    }

    for (const relationId of diff.removedRelations) {
      this.data.relations.delete(relationId);
    }

    for (const mod of diff.modifiedRelations) {
      const relation = this.data.relations.get(mod.id);
      if (relation) {
        (relation as any)[mod.field] = mod.after;
      }
    }

    for (const constraintId of diff.removedConstraints) {
      this.data.constraints.delete(constraintId);
    }

    for (const goalId of diff.removedGoals) {
      this.data.goals.delete(goalId);
    }

    this.data.checksum = Snapshot.computeChecksum(this.data.entities, this.data.relations);
    this.data.version++;

    return ok(true);
  }

  rollback(patch: SnapshotPatch): Result<true, ValidationError> {
    const diff = patch.diffs;

    for (const entityId of diff.addedEntities) {
      this.data.entities.delete(entityId);
    }

    for (const entityId of diff.removedEntities) {
      this.data.entities.set(entityId, {} as SnapshotEntity);
    }

    for (const mod of diff.modifiedEntities) {
      const entity = this.data.entities.get(mod.id);
      if (entity) {
        (entity as any)[mod.field] = mod.before;
      }
    }

    for (const relationId of diff.addedRelations) {
      this.data.relations.delete(relationId);
    }

    for (const relationId of diff.removedRelations) {
      this.data.relations.set(relationId, {} as SnapshotRelation);
    }

    for (const mod of diff.modifiedRelations) {
      const relation = this.data.relations.get(mod.id);
      if (relation) {
        (relation as any)[mod.field] = mod.before;
      }
    }

    for (const constraintId of diff.addedConstraints) {
      this.data.constraints.delete(constraintId);
    }

    for (const goalId of diff.addedGoals) {
      this.data.goals.delete(goalId);
    }

    this.data.checksum = Snapshot.computeChecksum(this.data.entities, this.data.relations);
    this.data.version++;

    return ok(true);
  }

  compress(): CompressedSnapshot {
    const serializable = {
      entities: Array.from(this.data.entities.entries()).map(([id, e]) => [
        id,
        {
          ...e,
          properties: Object.fromEntries(e.properties),
          tags: Array.from(e.tags),
          childIds: Array.from(e.childIds),
        },
      ]),
      relations: Array.from(this.data.relations.entries()).map(([id, r]) => [
        id,
        { ...r, properties: Object.fromEntries(r.properties) },
      ]),
      constraints: Array.from(this.data.constraints.entries()).map(([id, c]) => [
        id,
        { ...c, scope: Array.from(c.scope) },
      ]),
      goals: Array.from(this.data.goals.entries()).map(([id, g]) => [
        id,
        {
          ...g,
          constraintIds: Array.from(g.constraintIds),
          subGoalIds: Array.from(g.subGoalIds),
        },
      ]),
      globalState: this.data.globalState,
      version: this.data.version,
    };

    const raw = JSON.stringify(serializable);
    const compressed = Snapshot.simpleCompress(raw);

    return {
      id: this.id,
      timestamp: this.createdAt,
      version: this.data.version,
      data: compressed,
      originalSize: raw.length,
      compressedSize: compressed.length,
      checksum: this.data.checksum,
    };
  }

  getId(): string {
    return this.id;
  }

  getCreatedAt(): string {
    return this.createdAt;
  }

  getVersion(): number {
    return this.data.version;
  }

  getChecksum(): string {
    return this.data.checksum;
  }

  getEntityCount(): number {
    return this.data.entities.size;
  }

  getRelationCount(): number {
    return this.data.relations.size;
  }

  getConstraintCount(): number {
    return this.data.constraints.size;
  }

  getGoalCount(): number {
    return this.data.goals.size;
  }

  getEntity(id: string): SnapshotEntity | undefined {
    return this.data.entities.get(id);
  }

  getRelation(id: string): SnapshotRelation | undefined {
    return this.data.relations.get(id);
  }

  getAllEntityIds(): string[] {
    return Array.from(this.data.entities.keys());
  }

  getAllRelationIds(): string[] {
    return Array.from(this.data.relations.keys());
  }

  getGlobalState(): Record<string, unknown> {
    return { ...this.data.globalState };
  }

  setGlobalState(state: Record<string, unknown>): void {
    this.data.globalState = { ...state };
  }

  private diffEntities(
    a: SnapshotEntity,
    b: SnapshotEntity
  ): Array<{ id: string; field: string; before: unknown; after: unknown }> {
    const modifications: Array<{ id: string; field: string; before: unknown; after: unknown }> = [];

    if (a.name !== b.name) {
      modifications.push({ id: a.id, field: "name", before: a.name, after: b.name });
    }
    if (a.type !== b.type) {
      modifications.push({ id: a.id, field: "type", before: a.type, after: b.type });
    }
    if (a.parentId !== b.parentId) {
      modifications.push({ id: a.id, field: "parentId", before: a.parentId, after: b.parentId });
    }

    for (const [key, value] of b.properties) {
      const aValue = a.properties.get(key);
      if (aValue !== value) {
        modifications.push({ id: a.id, field: `properties.${key}`, before: aValue, after: value });
      }
    }

    return modifications;
  }

  private diffRelations(
    a: SnapshotRelation,
    b: SnapshotRelation
  ): Array<{ id: string; field: string; before: unknown; after: unknown }> {
    const modifications: Array<{ id: string; field: string; before: unknown; after: unknown }> = [];

    if (a.weight !== b.weight) {
      modifications.push({ id: a.id, field: "weight", before: a.weight, after: b.weight });
    }
    if (a.type !== b.type) {
      modifications.push({ id: a.id, field: "type", before: a.type, after: b.type });
    }
    if (a.bidirectional !== b.bidirectional) {
      modifications.push({ id: a.id, field: "bidirectional", before: a.bidirectional, after: b.bidirectional });
    }

    for (const [key, value] of b.properties) {
      const aValue = a.properties.get(key);
      if (aValue !== value) {
        modifications.push({ id: a.id, field: `properties.${key}`, before: aValue, after: value });
      }
    }

    return modifications;
  }

  private findEntityInPatch(patch: SnapshotPatch, entityId: string): SnapshotEntity | undefined {
    void patch;
    void entityId;
    return undefined;
  }

  private static computeChecksum(entities: Map<string, unknown>, relations: Map<string, unknown>): string {
    const entityIds = Array.from(entities.keys()).sort();
    const relationIds = Array.from(relations.keys()).sort();
    const raw = JSON.stringify({ entities: entityIds, relations: relationIds });
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(16);
  }

  private static computeChecksumDelta(a: string, b: string): string {
    let hash = 0;
    const combined = a + b;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(16);
  }

  private static simpleCompress(data: string): string {
    const dict = new Map<string, number>();
    const result: number[] = [];
    let w = "";
    let dictSize = 256;

    for (let i = 0; i < 256; i++) {
      dict.set(String.fromCharCode(i), i);
    }

    for (let i = 0; i < data.length; i++) {
      const c = data[i];
      const wc = w + c;
      if (dict.has(wc)) {
        w = wc;
      } else {
        result.push(dict.get(w)!);
        dict.set(wc, dictSize++);
        w = c;
      }
    }

    if (w.length > 0) {
      result.push(dict.get(w)!);
    }

    return result.join(",");
  }
}
