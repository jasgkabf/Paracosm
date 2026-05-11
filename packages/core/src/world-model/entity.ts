import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { EntityType } from "@paracosm/shared";
import { generateId, generateEntityId } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import type { EntityRecord } from "./types.js";

interface EntityCreateParams {
  name: string;
  type: EntityType;
  description?: string;
  properties?: Record<string, unknown>;
  tags?: string[];
  metadata?: Record<string, unknown>;
  parentId?: string | null;
}

interface EntityDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

const REQUIRED_ENTITY_FIELDS = ["name", "type"] as const;

const VALID_ENTITY_TYPES = new Set<string>(Object.values(EntityType));

export class Entity {
  static create(params: EntityCreateParams): Result<EntityRecord, ValidationError> {
    const validation = Entity.validateParams(params);
    if (!validation.ok) {
      return validation;
    }

    const now = new Date().toISOString();
    const id = generateEntityId(params.type);

    const properties = new Map<string, unknown>();
    if (params.properties) {
      for (const [key, value] of Object.entries(params.properties)) {
        properties.set(key, value);
      }
    }

    const tags = new Set<string>(params.tags ?? []);

    const record: EntityRecord = {
      id,
      entityType: params.type,
      name: params.name,
      description: params.description ?? "",
      properties,
      tags,
      metadata: params.metadata ?? {},
      parentId: params.parentId ?? null,
      childIds: new Set(),
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    return ok(record);
  }

  static validateParams(params: Partial<EntityCreateParams>): Result<true, ValidationError> {
    if (!params.name || typeof params.name !== "string" || params.name.trim().length === 0) {
      return err(new ValidationError("Entity name is required and must be a non-empty string", {
        field: "name",
      }));
    }

    if (params.name.length > 256) {
      return err(new ValidationError("Entity name must not exceed 256 characters", {
        field: "name",
        maxLength: 256,
        actualLength: params.name.length,
      }));
    }

    if (!params.type || !VALID_ENTITY_TYPES.has(params.type)) {
      return err(new ValidationError("Entity type is required and must be a valid EntityType", {
        field: "type",
        validTypes: Object.values(EntityType),
      }));
    }

    if (params.description !== undefined && typeof params.description !== "string") {
      return err(new ValidationError("Entity description must be a string", {
        field: "description",
      }));
    }

    if (params.tags !== undefined) {
      if (!Array.isArray(params.tags)) {
        return err(new ValidationError("Entity tags must be an array of strings", {
          field: "tags",
        }));
      }
      for (const tag of params.tags) {
        if (typeof tag !== "string" || tag.trim().length === 0) {
          return err(new ValidationError("Each tag must be a non-empty string", {
            field: "tags",
            invalidTag: tag,
          }));
        }
      }
    }

    if (params.properties !== undefined) {
      if (typeof params.properties !== "object" || params.properties === null || Array.isArray(params.properties)) {
        return err(new ValidationError("Entity properties must be a plain object", {
          field: "properties",
        }));
      }
    }

    if (params.metadata !== undefined) {
      if (typeof params.metadata !== "object" || params.metadata === null || Array.isArray(params.metadata)) {
        return err(new ValidationError("Entity metadata must be a plain object", {
          field: "metadata",
        }));
      }
    }

    if (params.parentId !== undefined && params.parentId !== null) {
      if (typeof params.parentId !== "string" || params.parentId.trim().length === 0) {
        return err(new ValidationError("Entity parentId must be a non-empty string or null", {
          field: "parentId",
        }));
      }
    }

    return ok(true);
  }

  static validate(record: EntityRecord): Result<true, ValidationError> {
    if (!record.id || typeof record.id !== "string") {
      return err(new ValidationError("Entity id is required and must be a string", {
        field: "id",
      }));
    }

    if (!record.name || typeof record.name !== "string" || record.name.trim().length === 0) {
      return err(new ValidationError("Entity name is required and must be a non-empty string", {
        field: "name",
        entityId: record.id,
      }));
    }

    if (!VALID_ENTITY_TYPES.has(record.entityType)) {
      return err(new ValidationError("Entity type must be a valid EntityType", {
        field: "entityType",
        entityId: record.id,
        invalidType: record.entityType,
      }));
    }

    if (typeof record.description !== "string") {
      return err(new ValidationError("Entity description must be a string", {
        field: "description",
        entityId: record.id,
      }));
    }

    if (!(record.properties instanceof Map)) {
      return err(new ValidationError("Entity properties must be a Map", {
        field: "properties",
        entityId: record.id,
      }));
    }

    if (!(record.tags instanceof Set)) {
      return err(new ValidationError("Entity tags must be a Set", {
        field: "tags",
        entityId: record.id,
      }));
    }

    if (typeof record.version !== "number" || record.version < 1) {
      return err(new ValidationError("Entity version must be a positive number", {
        field: "version",
        entityId: record.id,
      }));
    }

    if (record.parentId !== null && typeof record.parentId !== "string") {
      return err(new ValidationError("Entity parentId must be a string or null", {
        field: "parentId",
        entityId: record.id,
      }));
    }

    if (!(record.childIds instanceof Set)) {
      return err(new ValidationError("Entity childIds must be a Set", {
        field: "childIds",
        entityId: record.id,
      }));
    }

    if (typeof record.createdAt !== "string") {
      return err(new ValidationError("Entity createdAt must be an ISO string", {
        field: "createdAt",
        entityId: record.id,
      }));
    }

    if (typeof record.updatedAt !== "string") {
      return err(new ValidationError("Entity updatedAt must be an ISO string", {
        field: "updatedAt",
        entityId: record.id,
      }));
    }

    return ok(true);
  }

  static serialize(record: EntityRecord): Record<string, unknown> {
    const propertiesObj: Record<string, unknown> = {};
    for (const [key, value] of record.properties) {
      propertiesObj[key] = value;
    }

    return {
      id: record.id,
      entityType: record.entityType,
      name: record.name,
      description: record.description,
      properties: propertiesObj,
      tags: Array.from(record.tags),
      metadata: record.metadata,
      parentId: record.parentId,
      childIds: Array.from(record.childIds),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    };
  }

  static deserialize(data: Record<string, unknown>): Result<EntityRecord, ValidationError> {
    if (!data || typeof data !== "object") {
      return err(new ValidationError("Entity data must be a non-null object"));
    }

    if (!data.id || typeof data.id !== "string") {
      return err(new ValidationError("Entity data must contain a string 'id' field"));
    }

    if (!data.entityType || typeof data.entityType !== "string") {
      return err(new ValidationError("Entity data must contain a string 'entityType' field"));
    }

    const properties = new Map<string, unknown>();
    if (data.properties && typeof data.properties === "object" && !Array.isArray(data.properties)) {
      for (const [key, value] of Object.entries(data.properties as Record<string, unknown>)) {
        properties.set(key, value);
      }
    }

    const tags = new Set<string>();
    if (Array.isArray(data.tags)) {
      for (const tag of data.tags) {
        if (typeof tag === "string") {
          tags.add(tag);
        }
      }
    }

    const childIds = new Set<string>();
    if (Array.isArray(data.childIds)) {
      for (const childId of data.childIds) {
        if (typeof childId === "string") {
          childIds.add(childId);
        }
      }
    }

    const record: EntityRecord = {
      id: data.id as string,
      entityType: data.entityType as EntityType,
      name: (data.name as string) ?? "",
      description: (data.description as string) ?? "",
      properties,
      tags,
      metadata: (data.metadata as Record<string, unknown>) ?? {},
      parentId: (data.parentId as string | null) ?? null,
      childIds,
      createdAt: (data.createdAt as string) ?? new Date().toISOString(),
      updatedAt: (data.updatedAt as string) ?? new Date().toISOString(),
      version: (data.version as number) ?? 1,
    };

    const validation = Entity.validate(record);
    if (!validation.ok) {
      return validation;
    }

    return ok(record);
  }

  static merge(base: EntityRecord, override: EntityRecord): EntityRecord {
    const mergedProperties = new Map<string, unknown>(base.properties);
    for (const [key, value] of override.properties) {
      mergedProperties.set(key, value);
    }

    const mergedTags = new Set<string>(base.tags);
    for (const tag of override.tags) {
      mergedTags.add(tag);
    }

    const mergedChildIds = new Set<string>(base.childIds);
    for (const childId of override.childIds) {
      mergedChildIds.add(childId);
    }

    const mergedMetadata = { ...base.metadata, ...override.metadata };

    return {
      id: base.id,
      entityType: override.entityType ?? base.entityType,
      name: override.name ?? base.name,
      description: override.description ?? base.description,
      properties: mergedProperties,
      tags: mergedTags,
      metadata: mergedMetadata,
      parentId: override.parentId !== undefined ? override.parentId : base.parentId,
      childIds: mergedChildIds,
      createdAt: base.createdAt,
      updatedAt: new Date().toISOString(),
      version: Math.max(base.version, override.version) + 1,
    };
  }

  static clone(record: EntityRecord): EntityRecord {
    const clonedProperties = new Map<string, unknown>();
    for (const [key, value] of record.properties) {
      clonedProperties.set(key, typeof value === "object" && value !== null ? JSON.parse(JSON.stringify(value)) : value);
    }

    return {
      id: record.id,
      entityType: record.entityType,
      name: record.name,
      description: record.description,
      properties: clonedProperties,
      tags: new Set(record.tags),
      metadata: JSON.parse(JSON.stringify(record.metadata)),
      parentId: record.parentId,
      childIds: new Set(record.childIds),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    };
  }

  static diff(before: EntityRecord, after: EntityRecord): EntityDiff[] {
    const diffs: EntityDiff[] = [];

    if (before.name !== after.name) {
      diffs.push({ field: "name", oldValue: before.name, newValue: after.name });
    }

    if (before.description !== after.description) {
      diffs.push({ field: "description", oldValue: before.description, newValue: after.description });
    }

    if (before.entityType !== after.entityType) {
      diffs.push({ field: "entityType", oldValue: before.entityType, newValue: after.entityType });
    }

    if (before.parentId !== after.parentId) {
      diffs.push({ field: "parentId", oldValue: before.parentId, newValue: after.parentId });
    }

    const beforeTags = Array.from(before.tags).sort();
    const afterTags = Array.from(after.tags).sort();
    if (beforeTags.join(",") !== afterTags.join(",")) {
      diffs.push({ field: "tags", oldValue: beforeTags, newValue: afterTags });
    }

    const beforePropKeys = new Set(before.properties.keys());
    const afterPropKeys = new Set(after.properties.keys());

    for (const key of beforePropKeys) {
      if (!afterPropKeys.has(key)) {
        diffs.push({ field: `properties.${key}`, oldValue: before.properties.get(key), newValue: undefined });
      } else if (JSON.stringify(before.properties.get(key)) !== JSON.stringify(after.properties.get(key))) {
        diffs.push({ field: `properties.${key}`, oldValue: before.properties.get(key), newValue: after.properties.get(key) });
      }
    }

    for (const key of afterPropKeys) {
      if (!beforePropKeys.has(key)) {
        diffs.push({ field: `properties.${key}`, oldValue: undefined, newValue: after.properties.get(key) });
      }
    }

    return diffs;
  }
}
