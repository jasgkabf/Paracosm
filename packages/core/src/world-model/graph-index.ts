import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { EntityType, RelationType } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import type { EntityRecord, RelationRecord } from "./types.js";

type IndexType = "type" | "relation" | "property" | "tag" | "fulltext";

interface IndexEntry {
  key: string;
  values: Set<string>;
}

interface IndexDefinition {
  name: string;
  type: IndexType;
  field: string | null;
  createdAt: string;
  updatedAt: string;
  entryCount: number;
}

export class GraphIndex {
  private indexes: Map<string, Map<string, Set<string>>>;
  private definitions: Map<string, IndexDefinition>;
  private dirty: Set<string>;

  constructor() {
    this.indexes = new Map();
    this.definitions = new Map();
    this.dirty = new Set();
  }

  createIndex(name: string, type: IndexType, field?: string): Result<IndexDefinition, ValidationError> {
    if (this.indexes.has(name)) {
      return err(new ValidationError("Index already exists", { indexName: name }));
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return err(new ValidationError("Index name must be a non-empty string", { field: "name" }));
    }

    const validTypes: IndexType[] = ["type", "relation", "property", "tag", "fulltext"];
    if (!validTypes.includes(type)) {
      return err(new ValidationError("Invalid index type", {
        indexType: type,
        validTypes,
      }));
    }

    if (type === "property" && (!field || field.trim().length === 0)) {
      return err(new ValidationError("Property index requires a field name", {
        indexType: type,
      }));
    }

    if (type === "fulltext" && (!field || field.trim().length === 0)) {
      return err(new ValidationError("Fulltext index requires a field name", {
        indexType: type,
      }));
    }

    const now = new Date().toISOString();
    const definition: IndexDefinition = {
      name,
      type,
      field: field ?? null,
      createdAt: now,
      updatedAt: now,
      entryCount: 0,
    };

    this.indexes.set(name, new Map());
    this.definitions.set(name, definition);
    this.dirty.add(name);

    return ok({ ...definition });
  }

  dropIndex(name: string): Result<true, ValidationError> {
    if (!this.indexes.has(name)) {
      return err(new ValidationError("Index not found", { indexName: name }));
    }

    this.indexes.delete(name);
    this.definitions.delete(name);
    this.dirty.delete(name);

    return ok(true);
  }

  hasIndex(name: string): boolean {
    return this.indexes.has(name);
  }

  lookup(indexName: string, key: string): Result<string[], ValidationError> {
    const index = this.indexes.get(indexName);
    if (!index) {
      return err(new ValidationError("Index not found", { indexName }));
    }

    const values = index.get(key);
    if (!values) {
      return ok([]);
    }

    return ok(Array.from(values));
  }

  rangeScan(indexName: string, startKey: string, endKey: string): Result<string[], ValidationError> {
    const index = this.indexes.get(indexName);
    if (!index) {
      return err(new ValidationError("Index not found", { indexName }));
    }

    const results: string[] = [];
    for (const [key, values] of index) {
      if (key >= startKey && key <= endKey) {
        for (const value of values) {
          results.push(value);
        }
      }
    }

    return ok(results);
  }

  fulltextSearch(indexName: string, query: string): Result<string[], ValidationError> {
    const definition = this.definitions.get(indexName);
    if (!definition) {
      return err(new ValidationError("Index not found", { indexName }));
    }

    if (definition.type !== "fulltext") {
      return err(new ValidationError("Index is not a fulltext index", { indexName, type: definition.type }));
    }

    const index = this.indexes.get(indexName);
    if (!index) {
      return ok([]);
    }

    const queryLower = query.toLowerCase();
    const queryTokens = queryLower.split(/\s+/).filter((t) => t.length > 0);
    const results = new Set<string>();

    for (const [key, values] of index) {
      const keyLower = key.toLowerCase();
      const matches = queryTokens.some((token) => keyLower.includes(token));
      if (matches) {
        for (const value of values) {
          results.add(value);
        }
      }
    }

    return ok(Array.from(results));
  }

  rebuild(entities: EntityRecord[], relations: RelationRecord[]): Result<true, ValidationError> {
    for (const [name, definition] of this.definitions) {
      this.indexes.set(name, new Map());
      definition.entryCount = 0;

      switch (definition.type) {
        case "type":
          this.rebuildTypeIndex(name, entities);
          break;
        case "relation":
          this.rebuildRelationIndex(name, relations);
          break;
        case "property":
          if (definition.field) {
            this.rebuildPropertyIndex(name, definition.field, entities);
          }
          break;
        case "tag":
          this.rebuildTagIndex(name, entities);
          break;
        case "fulltext":
          if (definition.field) {
            this.rebuildFulltextIndex(name, definition.field, entities);
          }
          break;
      }

      definition.updatedAt = new Date().toISOString();
      this.dirty.delete(name);
    }

    return ok(true);
  }

  addEntityToIndex(entity: EntityRecord): void {
    for (const [name, definition] of this.definitions) {
      const index = this.indexes.get(name);
      if (!index) continue;

      switch (definition.type) {
        case "type": {
          const key = entity.entityType;
          if (!index.has(key)) index.set(key, new Set());
          index.get(key)!.add(entity.id);
          definition.entryCount++;
          break;
        }
        case "property": {
          if (definition.field) {
            const value = entity.properties.get(definition.field);
            if (value !== undefined) {
              const key = String(value);
              if (!index.has(key)) index.set(key, new Set());
              index.get(key)!.add(entity.id);
              definition.entryCount++;
            }
          }
          break;
        }
        case "tag": {
          for (const tag of entity.tags) {
            if (!index.has(tag)) index.set(tag, new Set());
            index.get(tag)!.add(entity.id);
            definition.entryCount++;
          }
          break;
        }
        case "fulltext": {
          if (definition.field) {
            const value = entity.properties.get(definition.field);
            if (typeof value === "string") {
              const tokens = value.toLowerCase().split(/\s+/);
              for (const token of tokens) {
                if (!index.has(token)) index.set(token, new Set());
                index.get(token)!.add(entity.id);
                definition.entryCount++;
              }
            }
          }
          break;
        }
      }

      this.dirty.add(name);
    }
  }

  removeEntityFromIndex(entity: EntityRecord): void {
    for (const [name, definition] of this.definitions) {
      const index = this.indexes.get(name);
      if (!index) continue;

      switch (definition.type) {
        case "type": {
          const key = entity.entityType;
          const values = index.get(key);
          if (values) {
            values.delete(entity.id);
            if (values.size === 0) index.delete(key);
            definition.entryCount = Math.max(0, definition.entryCount - 1);
          }
          break;
        }
        case "property": {
          if (definition.field) {
            const value = entity.properties.get(definition.field);
            if (value !== undefined) {
              const key = String(value);
              const values = index.get(key);
              if (values) {
                values.delete(entity.id);
                if (values.size === 0) index.delete(key);
                definition.entryCount = Math.max(0, definition.entryCount - 1);
              }
            }
          }
          break;
        }
        case "tag": {
          for (const tag of entity.tags) {
            const values = index.get(tag);
            if (values) {
              values.delete(entity.id);
              if (values.size === 0) index.delete(tag);
              definition.entryCount = Math.max(0, definition.entryCount - 1);
            }
          }
          break;
        }
        case "fulltext": {
          if (definition.field) {
            const value = entity.properties.get(definition.field);
            if (typeof value === "string") {
              const tokens = value.toLowerCase().split(/\s+/);
              for (const token of tokens) {
                const values = index.get(token);
                if (values) {
                  values.delete(entity.id);
                  if (values.size === 0) index.delete(token);
                  definition.entryCount = Math.max(0, definition.entryCount - 1);
                }
              }
            }
          }
          break;
        }
      }

      this.dirty.add(name);
    }
  }

  addRelationToIndex(relation: RelationRecord): void {
    for (const [name, definition] of this.definitions) {
      if (definition.type !== "relation") continue;

      const index = this.indexes.get(name);
      if (!index) continue;

      const key = relation.relationType;
      if (!index.has(key)) index.set(key, new Set());
      index.get(key)!.add(relation.id);
      definition.entryCount++;
      this.dirty.add(name);
    }
  }

  removeRelationFromIndex(relation: RelationRecord): void {
    for (const [name, definition] of this.definitions) {
      if (definition.type !== "relation") continue;

      const index = this.indexes.get(name);
      if (!index) continue;

      const key = relation.relationType;
      const values = index.get(key);
      if (values) {
        values.delete(relation.id);
        if (values.size === 0) index.delete(key);
        definition.entryCount = Math.max(0, definition.entryCount - 1);
      }
      this.dirty.add(name);
    }
  }

  getDefinition(name: string): IndexDefinition | undefined {
    const def = this.definitions.get(name);
    return def ? { ...def } : undefined;
  }

  listIndexes(): IndexDefinition[] {
    return Array.from(this.definitions.values()).map((d) => ({ ...d }));
  }

  getIndexSize(name: string): number {
    const index = this.indexes.get(name);
    if (!index) return 0;

    let total = 0;
    for (const values of index.values()) {
      total += values.size;
    }
    return total;
  }

  isDirty(name: string): boolean {
    return this.dirty.has(name);
  }

  clear(): void {
    this.indexes.clear();
    this.definitions.clear();
    this.dirty.clear();
  }

  private rebuildTypeIndex(name: string, entities: EntityRecord[]): void {
    const index = this.indexes.get(name)!;
    const definition = this.definitions.get(name)!;

    for (const entity of entities) {
      const key = entity.entityType;
      if (!index.has(key)) index.set(key, new Set());
      index.get(key)!.add(entity.id);
      definition.entryCount++;
    }
  }

  private rebuildRelationIndex(name: string, relations: RelationRecord[]): void {
    const index = this.indexes.get(name)!;
    const definition = this.definitions.get(name)!;

    for (const relation of relations) {
      const key = relation.relationType;
      if (!index.has(key)) index.set(key, new Set());
      index.get(key)!.add(relation.id);
      definition.entryCount++;
    }
  }

  private rebuildPropertyIndex(name: string, field: string, entities: EntityRecord[]): void {
    const index = this.indexes.get(name)!;
    const definition = this.definitions.get(name)!;

    for (const entity of entities) {
      const value = entity.properties.get(field);
      if (value !== undefined) {
        const key = String(value);
        if (!index.has(key)) index.set(key, new Set());
        index.get(key)!.add(entity.id);
        definition.entryCount++;
      }
    }
  }

  private rebuildTagIndex(name: string, entities: EntityRecord[]): void {
    const index = this.indexes.get(name)!;
    const definition = this.definitions.get(name)!;

    for (const entity of entities) {
      for (const tag of entity.tags) {
        if (!index.has(tag)) index.set(tag, new Set());
        index.get(tag)!.add(entity.id);
        definition.entryCount++;
      }
    }
  }

  private rebuildFulltextIndex(name: string, field: string, entities: EntityRecord[]): void {
    const index = this.indexes.get(name)!;
    const definition = this.definitions.get(name)!;

    for (const entity of entities) {
      const value = entity.properties.get(field);
      if (typeof value === "string") {
        const tokens = value.toLowerCase().split(/\s+/);
        for (const token of tokens) {
          if (token.length === 0) continue;
          if (!index.has(token)) index.set(token, new Set());
          index.get(token)!.add(entity.id);
          definition.entryCount++;
        }
      }
    }
  }
}
