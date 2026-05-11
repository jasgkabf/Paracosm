import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { RelationType, EntityType } from "@paracosm/shared";
import { generateId } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import type { RelationRecord, Cardinality, RelationRule } from "./types.js";

interface RelationCreateParams {
  sourceId: string;
  targetId: string;
  type: RelationType;
  label?: string;
  weight?: number;
  bidirectional?: boolean;
  properties?: Record<string, unknown>;
}

const VALID_RELATION_TYPES = new Set<string>(Object.values(RelationType));

const DEFAULT_RELATION_RULES: RelationRule[] = [
  { type: RelationType.DependsOn, cardinality: "many-to-many", bidirectional: false, transitive: true, allowedSourceTypes: Object.values(EntityType), allowedTargetTypes: Object.values(EntityType) },
  { type: RelationType.Influences, cardinality: "many-to-many", bidirectional: false, transitive: true, allowedSourceTypes: Object.values(EntityType), allowedTargetTypes: Object.values(EntityType) },
  { type: RelationType.Contains, cardinality: "one-to-many", bidirectional: false, transitive: true, allowedSourceTypes: [EntityType.Location, EntityType.Organization, EntityType.Process], allowedTargetTypes: Object.values(EntityType) },
  { type: RelationType.BelongsTo, cardinality: "many-to-one", bidirectional: false, transitive: true, allowedSourceTypes: Object.values(EntityType), allowedTargetTypes: [EntityType.Location, EntityType.Organization, EntityType.Process] },
  { type: RelationType.Precedes, cardinality: "many-to-many", bidirectional: false, transitive: true, allowedSourceTypes: [EntityType.Event, EntityType.Process], allowedTargetTypes: [EntityType.Event, EntityType.Process] },
  { type: RelationType.Enables, cardinality: "many-to-many", bidirectional: false, transitive: true, allowedSourceTypes: Object.values(EntityType), allowedTargetTypes: Object.values(EntityType) },
  { type: RelationType.Inhibits, cardinality: "many-to-many", bidirectional: false, transitive: false, allowedSourceTypes: Object.values(EntityType), allowedTargetTypes: Object.values(EntityType) },
  { type: RelationType.Transforms, cardinality: "one-to-one", bidirectional: false, transitive: false, allowedSourceTypes: [EntityType.Process, EntityType.Agent], allowedTargetTypes: [EntityType.Resource, EntityType.Artifact] },
  { type: RelationType.Communicates, cardinality: "many-to-many", bidirectional: true, transitive: false, allowedSourceTypes: [EntityType.Agent, EntityType.Organization], allowedTargetTypes: [EntityType.Agent, EntityType.Organization] },
  { type: RelationType.Competes, cardinality: "many-to-many", bidirectional: true, transitive: false, allowedSourceTypes: [EntityType.Agent, EntityType.Organization], allowedTargetTypes: [EntityType.Agent, EntityType.Organization] },
];

export class Relation {
  private rules: Map<RelationType, RelationRule>;

  constructor(customRules?: RelationRule[]) {
    this.rules = new Map();
    const rulesToLoad = customRules ?? DEFAULT_RELATION_RULES;
    for (const rule of rulesToLoad) {
      this.rules.set(rule.type, rule);
    }
  }

  static create(params: RelationCreateParams): Result<RelationRecord, ValidationError> {
    const validation = Relation.validateParams(params);
    if (!validation.ok) {
      return validation;
    }

    const now = new Date().toISOString();
    const id = `rel_${generateId()}`;

    const properties = new Map<string, unknown>();
    if (params.properties) {
      for (const [key, value] of Object.entries(params.properties)) {
        properties.set(key, value);
      }
    }

    const record: RelationRecord = {
      id,
      sourceId: params.sourceId,
      targetId: params.targetId,
      relationType: params.type,
      label: params.label ?? params.type,
      weight: params.weight ?? 1.0,
      bidirectional: params.bidirectional ?? false,
      properties,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    return ok(record);
  }

  static validateParams(params: Partial<RelationCreateParams>): Result<true, ValidationError> {
    if (!params.sourceId || typeof params.sourceId !== "string" || params.sourceId.trim().length === 0) {
      return err(new ValidationError("Relation sourceId is required and must be a non-empty string", {
        field: "sourceId",
      }));
    }

    if (!params.targetId || typeof params.targetId !== "string" || params.targetId.trim().length === 0) {
      return err(new ValidationError("Relation targetId is required and must be a non-empty string", {
        field: "targetId",
      }));
    }

    if (params.sourceId === params.targetId) {
      return err(new ValidationError("Relation sourceId and targetId must be different", {
        field: "sourceId",
        sourceId: params.sourceId,
        targetId: params.targetId,
      }));
    }

    if (!params.type || !VALID_RELATION_TYPES.has(params.type)) {
      return err(new ValidationError("Relation type is required and must be a valid RelationType", {
        field: "type",
        validTypes: Object.values(RelationType),
      }));
    }

    if (params.weight !== undefined) {
      if (typeof params.weight !== "number" || !Number.isFinite(params.weight) || params.weight < 0 || params.weight > 1) {
        return err(new ValidationError("Relation weight must be a number between 0 and 1", {
          field: "weight",
          value: params.weight,
        }));
      }
    }

    if (params.label !== undefined && (typeof params.label !== "string" || params.label.trim().length === 0)) {
      return err(new ValidationError("Relation label must be a non-empty string if provided", {
        field: "label",
      }));
    }

    if (params.properties !== undefined) {
      if (typeof params.properties !== "object" || params.properties === null || Array.isArray(params.properties)) {
        return err(new ValidationError("Relation properties must be a plain object", {
          field: "properties",
        }));
      }
    }

    return ok(true);
  }

  static validate(record: RelationRecord): Result<true, ValidationError> {
    if (!record.id || typeof record.id !== "string") {
      return err(new ValidationError("Relation id is required and must be a string", {
        field: "id",
      }));
    }

    if (!record.sourceId || typeof record.sourceId !== "string") {
      return err(new ValidationError("Relation sourceId is required and must be a string", {
        field: "sourceId",
        relationId: record.id,
      }));
    }

    if (!record.targetId || typeof record.targetId !== "string") {
      return err(new ValidationError("Relation targetId is required and must be a string", {
        field: "targetId",
        relationId: record.id,
      }));
    }

    if (record.sourceId === record.targetId) {
      return err(new ValidationError("Relation sourceId and targetId must be different", {
        field: "sourceId",
        relationId: record.id,
      }));
    }

    if (!VALID_RELATION_TYPES.has(record.relationType)) {
      return err(new ValidationError("Relation type must be a valid RelationType", {
        field: "relationType",
        relationId: record.id,
        invalidType: record.relationType,
      }));
    }

    if (typeof record.weight !== "number" || !Number.isFinite(record.weight) || record.weight < 0 || record.weight > 1) {
      return err(new ValidationError("Relation weight must be a number between 0 and 1", {
        field: "weight",
        relationId: record.id,
      }));
    }

    if (typeof record.bidirectional !== "boolean") {
      return err(new ValidationError("Relation bidirectional must be a boolean", {
        field: "bidirectional",
        relationId: record.id,
      }));
    }

    if (!(record.properties instanceof Map)) {
      return err(new ValidationError("Relation properties must be a Map", {
        field: "properties",
        relationId: record.id,
      }));
    }

    if (typeof record.version !== "number" || record.version < 1) {
      return err(new ValidationError("Relation version must be a positive number", {
        field: "version",
        relationId: record.id,
      }));
    }

    return ok(true);
  }

  static serialize(record: RelationRecord): Record<string, unknown> {
    const propertiesObj: Record<string, unknown> = {};
    for (const [key, value] of record.properties) {
      propertiesObj[key] = value;
    }

    return {
      id: record.id,
      sourceId: record.sourceId,
      targetId: record.targetId,
      relationType: record.relationType,
      label: record.label,
      weight: record.weight,
      bidirectional: record.bidirectional,
      properties: propertiesObj,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    };
  }

  static deserialize(data: Record<string, unknown>): Result<RelationRecord, ValidationError> {
    if (!data || typeof data !== "object") {
      return err(new ValidationError("Relation data must be a non-null object"));
    }

    if (!data.id || typeof data.id !== "string") {
      return err(new ValidationError("Relation data must contain a string 'id' field"));
    }

    if (!data.sourceId || typeof data.sourceId !== "string") {
      return err(new ValidationError("Relation data must contain a string 'sourceId' field"));
    }

    if (!data.targetId || typeof data.targetId !== "string") {
      return err(new ValidationError("Relation data must contain a string 'targetId' field"));
    }

    if (!data.relationType || typeof data.relationType !== "string") {
      return err(new ValidationError("Relation data must contain a string 'relationType' field"));
    }

    const properties = new Map<string, unknown>();
    if (data.properties && typeof data.properties === "object" && !Array.isArray(data.properties)) {
      for (const [key, value] of Object.entries(data.properties as Record<string, unknown>)) {
        properties.set(key, value);
      }
    }

    const record: RelationRecord = {
      id: data.id as string,
      sourceId: data.sourceId as string,
      targetId: data.targetId as string,
      relationType: data.relationType as RelationType,
      label: (data.label as string) ?? (data.relationType as string),
      weight: (data.weight as number) ?? 1.0,
      bidirectional: (data.bidirectional as boolean) ?? false,
      properties,
      createdAt: (data.createdAt as string) ?? new Date().toISOString(),
      updatedAt: (data.updatedAt as string) ?? new Date().toISOString(),
      version: (data.version as number) ?? 1,
    };

    const validation = Relation.validate(record);
    if (!validation.ok) {
      return validation;
    }

    return ok(record);
  }

  getRule(type: RelationType): RelationRule | undefined {
    return this.rules.get(type);
  }

  isBidirectional(type: RelationType): boolean {
    const rule = this.rules.get(type);
    return rule?.bidirectional ?? false;
  }

  isTransitive(type: RelationType): boolean {
    const rule = this.rules.get(type);
    return rule?.transitive ?? false;
  }

  getCardinality(type: RelationType): Cardinality {
    const rule = this.rules.get(type);
    return rule?.cardinality ?? "many-to-many";
  }

  checkCardinality(
    type: RelationType,
    existingRelations: RelationRecord[],
    newSourceId: string,
    newTargetId: string
  ): Result<true, ValidationError> {
    const rule = this.rules.get(type);
    if (!rule) {
      return ok(true);
    }

    const cardinality = rule.cardinality;

    if (cardinality === "one-to-one") {
      const sourceRelations = existingRelations.filter(
        (r) => r.sourceId === newSourceId && r.relationType === type
      );
      if (sourceRelations.length > 0) {
        return err(new ValidationError("Cardinality violation: one-to-one relation already exists from source", {
          relationType: type,
          sourceId: newSourceId,
          cardinality,
        }));
      }

      const targetRelations = existingRelations.filter(
        (r) => r.targetId === newTargetId && r.relationType === type
      );
      if (targetRelations.length > 0) {
        return err(new ValidationError("Cardinality violation: one-to-one relation already exists to target", {
          relationType: type,
          targetId: newTargetId,
          cardinality,
        }));
      }
    }

    if (cardinality === "one-to-many") {
      const sourceRelations = existingRelations.filter(
        (r) => r.sourceId === newSourceId && r.relationType === type
      );
      if (sourceRelations.length > 0) {
        return err(new ValidationError("Cardinality violation: one-to-many source already has a relation of this type", {
          relationType: type,
          sourceId: newSourceId,
          cardinality,
        }));
      }
    }

    if (cardinality === "many-to-one") {
      const targetRelations = existingRelations.filter(
        (r) => r.targetId === newTargetId && r.relationType === type
      );
      if (targetRelations.length > 0) {
        return err(new ValidationError("Cardinality violation: many-to-one target already has a relation of this type", {
          relationType: type,
          targetId: newTargetId,
          cardinality,
        }));
      }
    }

    return ok(true);
  }

  computeTransitiveClosure(
    relations: RelationRecord[],
    type: RelationType
  ): RelationRecord[] {
    const rule = this.rules.get(type);
    if (!rule || !rule.transitive) {
      return relations;
    }

    const adjacency = new Map<string, Set<string>>();
    for (const rel of relations) {
      if (rel.relationType !== type) continue;
      if (!adjacency.has(rel.sourceId)) {
        adjacency.set(rel.sourceId, new Set());
      }
      adjacency.get(rel.sourceId)!.add(rel.targetId);
    }

    const closure = new Map<string, Set<string>>();
    for (const [source, targets] of adjacency) {
      closure.set(source, new Set(targets));
    }

    const allNodes = new Set<string>();
    for (const rel of relations) {
      if (rel.relationType === type) {
        allNodes.add(rel.sourceId);
        allNodes.add(rel.targetId);
      }
    }

    for (const k of allNodes) {
      for (const i of allNodes) {
        const iTargets = closure.get(i);
        if (!iTargets) continue;
        const kTargets = closure.get(k);
        if (!kTargets || !iTargets.has(k)) continue;
        for (const j of kTargets) {
          iTargets.add(j);
        }
      }
    }

    const existingPairs = new Set<string>();
    for (const rel of relations) {
      if (rel.relationType === type) {
        existingPairs.add(`${rel.sourceId}->${rel.targetId}`);
      }
    }

    const newRelations: RelationRecord[] = [];
    const now = new Date().toISOString();

    for (const [source, targets] of closure) {
      for (const target of targets) {
        const pair = `${source}->${target}`;
        if (!existingPairs.has(pair)) {
          newRelations.push({
            id: `rel_${generateId()}`,
            sourceId: source,
            targetId: target,
            relationType: type,
            label: `${type}_transitive`,
            weight: 0.5,
            bidirectional: false,
            properties: new Map([["inferred", true]]),
            createdAt: now,
            updatedAt: now,
            version: 1,
          });
          existingPairs.add(pair);
        }
      }
    }

    return [...relations, ...newRelations];
  }

  infer(
    relations: RelationRecord[],
    type: RelationType
  ): RelationRecord[] {
    const rule = this.rules.get(type);
    if (!rule) {
      return [];
    }

    if (rule.transitive) {
      const existingPairs = new Set<string>();
      for (const rel of relations) {
        if (rel.relationType === type) {
          existingPairs.add(`${rel.sourceId}->${rel.targetId}`);
        }
      }

      const closure = this.computeTransitiveClosure(relations, type);
      return closure.filter((r) => !existingPairs.has(`${r.sourceId}->${r.targetId}`));
    }

    if (rule.bidirectional) {
      const inferred: RelationRecord[] = [];
      const existingPairs = new Set<string>();
      for (const rel of relations) {
        if (rel.relationType === type) {
          existingPairs.add(`${rel.sourceId}->${rel.targetId}`);
          existingPairs.add(`${rel.targetId}->${rel.sourceId}`);
        }
      }

      const now = new Date().toISOString();
      for (const rel of relations) {
        if (rel.relationType === type) {
          const reversePair = `${rel.targetId}->${rel.sourceId}`;
          if (!existingPairs.has(reversePair)) {
            inferred.push({
              id: `rel_${generateId()}`,
              sourceId: rel.targetId,
              targetId: rel.sourceId,
              relationType: type,
              label: `${type}_inferred`,
              weight: rel.weight,
              bidirectional: true,
              properties: new Map<string, unknown>([["inferred", true], ["inverseOf", rel.id]]),
              createdAt: now,
              updatedAt: now,
              version: 1,
            });
          }
        }
      }

      return inferred;
    }

    return [];
  }
}
