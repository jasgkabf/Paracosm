import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { EntityType, RelationType } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import type { EntityRecord, RelationRecord, QueryPattern } from "./types.js";
import type { EntityGraph } from "./entity-graph.js";
import type { GraphIndex } from "./graph-index.js";

type AggregateFunction = "count" | "sum" | "avg" | "min" | "max";
type SortDirection = "asc" | "desc";

interface QueryPlan {
  useIndex: boolean;
  indexName: string | null;
  estimatedCost: number;
  steps: string[];
}

export class GraphQuery {
  private graph: EntityGraph;
  private indexManager: GraphIndex | null;
  private nodeType: EntityType | null;
  private edgeType: RelationType | null;
  private conditions: Array<(entity: EntityRecord) => boolean>;
  private relationConditions: Array<(relation: RelationRecord) => boolean>;
  private limitValue: number | null;
  private offsetValue: number;
  private sortField: string | null;
  private sortDirection: SortDirection;
  private propertyFilters: Map<string, unknown>;
  private tagFilters: Set<string>;
  private pathSource: string | null;
  private pathTarget: string | null;
  private neighborOf: string | null;
  private neighborDirection: "outgoing" | "incoming" | "both";
  private neighborDepth: number;

  constructor(graph: EntityGraph, indexManager?: GraphIndex) {
    this.graph = graph;
    this.indexManager = indexManager ?? null;
    this.nodeType = null;
    this.edgeType = null;
    this.conditions = [];
    this.relationConditions = [];
    this.limitValue = null;
    this.offsetValue = 0;
    this.sortField = null;
    this.sortDirection = "asc";
    this.propertyFilters = new Map();
    this.tagFilters = new Set();
    this.pathSource = null;
    this.pathTarget = null;
    this.neighborOf = null;
    this.neighborDirection = "both";
    this.neighborDepth = 1;
  }

  match(pattern: QueryPattern): GraphQuery {
    if (pattern.nodeType) {
      this.nodeType = pattern.nodeType;
    }
    if (pattern.edgeType) {
      this.edgeType = pattern.edgeType;
    }
    if (pattern.properties) {
      for (const [key, value] of Object.entries(pattern.properties)) {
        this.propertyFilters.set(key, value);
      }
    }
    if (pattern.tags) {
      for (const tag of pattern.tags) {
        this.tagFilters.add(tag);
      }
    }
    return this;
  }

  where(condition: (entity: EntityRecord) => boolean): GraphQuery {
    this.conditions.push(condition);
    return this;
  }

  whereRelation(condition: (relation: RelationRecord) => boolean): GraphQuery {
    this.relationConditions.push(condition);
    return this;
  }

  limit(n: number): GraphQuery {
    if (n < 0) {
      throw new Error("Limit must be non-negative");
    }
    this.limitValue = n;
    return this;
  }

  offset(n: number): GraphQuery {
    if (n < 0) {
      throw new Error("Offset must be non-negative");
    }
    this.offsetValue = n;
    return this;
  }

  orderBy(field: string, direction: SortDirection = "asc"): GraphQuery {
    this.sortField = field;
    this.sortDirection = direction;
    return this;
  }

  path(sourceId: string, targetId: string): GraphQuery {
    this.pathSource = sourceId;
    this.pathTarget = targetId;
    return this;
  }

  neighbor(entityId: string, direction: "outgoing" | "incoming" | "both" = "both", depth: number = 1): GraphQuery {
    this.neighborOf = entityId;
    this.neighborDirection = direction;
    this.neighborDepth = depth;
    return this;
  }

  execute(): Result<EntityRecord[], ValidationError> {
    const plan = this.optimize();

    let results: EntityRecord[];

    if (this.pathSource && this.pathTarget) {
      return this.executePathQuery();
    }

    if (this.neighborOf) {
      return this.executeNeighborQuery();
    }

    if (plan.useIndex && this.indexManager && this.nodeType) {
      const indexResult = this.indexManager.lookup("type", this.nodeType);
      if (indexResult.ok) {
        results = indexResult.value
          .map((id) => this.graph.getEntity(id))
          .filter((e): e is EntityRecord => e !== undefined);
      } else {
        results = this.graph.queryByType(this.nodeType!);
      }
    } else if (this.nodeType) {
      results = this.graph.queryByType(this.nodeType);
    } else {
      results = this.graph.getAllEntities();
    }

    results = this.applyPropertyFilters(results);
    results = this.applyTagFilters(results);
    results = this.applyConditions(results);

    if (this.edgeType) {
      results = this.applyRelationFilter(results);
    }

    if (this.sortField) {
      results = this.applySort(results);
    }

    results = results.slice(this.offsetValue);

    if (this.limitValue !== null) {
      results = results.slice(0, this.limitValue);
    }

    return ok(results);
  }

  aggregate(func: AggregateFunction, field?: string): Result<number, ValidationError> {
    const execResult = this.execute();
    if (!execResult.ok) {
      return execResult;
    }

    const results = execResult.value;

    switch (func) {
      case "count":
        return ok(results.length);

      case "sum": {
        if (!field) {
          return err(new ValidationError("Field is required for sum aggregation"));
        }
        const sum = results.reduce((acc, entity) => {
          const value = entity.properties.get(field);
          return acc + (typeof value === "number" ? value : 0);
        }, 0);
        return ok(sum);
      }

      case "avg": {
        if (!field) {
          return err(new ValidationError("Field is required for avg aggregation"));
        }
        if (results.length === 0) return ok(0);
        const sum = results.reduce((acc, entity) => {
          const value = entity.properties.get(field);
          return acc + (typeof value === "number" ? value : 0);
        }, 0);
        return ok(sum / results.length);
      }

      case "min": {
        if (!field) {
          return err(new ValidationError("Field is required for min aggregation"));
        }
        const values = results
          .map((e) => e.properties.get(field))
          .filter((v): v is number => typeof v === "number");
        if (values.length === 0) return ok(0);
        return ok(Math.min(...values));
      }

      case "max": {
        if (!field) {
          return err(new ValidationError("Field is required for max aggregation"));
        }
        const values = results
          .map((e) => e.properties.get(field))
          .filter((v): v is number => typeof v === "number");
        if (values.length === 0) return ok(0);
        return ok(Math.max(...values));
      }
    }
  }

  private optimize(): QueryPlan {
    const steps: string[] = [];
    let estimatedCost = this.graph.entityCount();
    let useIndex = false;
    let indexName: string | null = null;

    if (this.nodeType && this.indexManager) {
      const hasTypeIndex = this.indexManager.hasIndex("type");
      if (hasTypeIndex) {
        useIndex = true;
        indexName = "type";
        estimatedCost = Math.log2(this.graph.entityCount()) + this.graph.queryByType(this.nodeType).length;
        steps.push("use_type_index");
      }
    }

    if (this.propertyFilters.size > 0) {
      estimatedCost += this.graph.entityCount() * this.propertyFilters.size;
      steps.push("filter_properties");

      if (this.indexManager) {
        for (const [key] of this.propertyFilters) {
          if (this.indexManager.hasIndex(`prop_${key}`)) {
            useIndex = true;
            indexName = `prop_${key}`;
            estimatedCost = Math.log2(this.graph.entityCount());
            steps.push(`use_property_index_${key}`);
            break;
          }
        }
      }
    }

    if (this.tagFilters.size > 0) {
      estimatedCost += this.graph.entityCount() * this.tagFilters.size;
      steps.push("filter_tags");
    }

    if (this.conditions.length > 0) {
      estimatedCost += this.graph.entityCount() * this.conditions.length;
      steps.push("apply_conditions");
    }

    if (this.edgeType) {
      estimatedCost += this.graph.relationCount();
      steps.push("filter_by_relation");
    }

    if (this.sortField) {
      const n = this.graph.entityCount();
      estimatedCost += n * Math.log2(n);
      steps.push("sort");
    }

    return { useIndex, indexName, estimatedCost, steps };
  }

  private executePathQuery(): Result<EntityRecord[], ValidationError> {
    if (!this.pathSource || !this.pathTarget) {
      return err(new ValidationError("Path query requires source and target"));
    }

    if (!this.graph.hasEntity(this.pathSource)) {
      return err(new ValidationError("Source entity not found", { sourceId: this.pathSource }));
    }

    if (!this.graph.hasEntity(this.pathTarget)) {
      return err(new ValidationError("Target entity not found", { targetId: this.pathTarget }));
    }

    const pathIds = this.graph.shortestPath(this.pathSource, this.pathTarget);
    const results: EntityRecord[] = [];

    for (const id of pathIds) {
      const entity = this.graph.getEntity(id);
      if (entity) {
        results.push(entity);
      }
    }

    return ok(results);
  }

  private executeNeighborQuery(): Result<EntityRecord[], ValidationError> {
    if (!this.neighborOf) {
      return err(new ValidationError("Neighbor query requires an entity ID"));
    }

    if (!this.graph.hasEntity(this.neighborOf)) {
      return err(new ValidationError("Entity not found", { entityId: this.neighborOf }));
    }

    const neighbors = this.graph.queryByRelation(
      this.neighborOf,
      this.edgeType ?? undefined,
      this.neighborDirection
    );

    let results = neighbors;

    results = this.applyPropertyFilters(results);
    results = this.applyTagFilters(results);
    results = this.applyConditions(results);

    if (this.sortField) {
      results = this.applySort(results);
    }

    results = results.slice(this.offsetValue);

    if (this.limitValue !== null) {
      results = results.slice(0, this.limitValue);
    }

    return ok(results);
  }

  private applyPropertyFilters(entities: EntityRecord[]): EntityRecord[] {
    if (this.propertyFilters.size === 0) return entities;

    return entities.filter((entity) => {
      for (const [key, value] of this.propertyFilters) {
        const entityValue = entity.properties.get(key);
        if (entityValue !== value) {
          if (typeof value === "object" && value !== null) {
            if (JSON.stringify(entityValue) !== JSON.stringify(value)) {
              return false;
            }
          } else {
            return false;
          }
        }
      }
      return true;
    });
  }

  private applyTagFilters(entities: EntityRecord[]): EntityRecord[] {
    if (this.tagFilters.size === 0) return entities;

    return entities.filter((entity) => {
      for (const tag of this.tagFilters) {
        if (!entity.tags.has(tag)) {
          return false;
        }
      }
      return true;
    });
  }

  private applyConditions(entities: EntityRecord[]): EntityRecord[] {
    if (this.conditions.length === 0) return entities;

    return entities.filter((entity) => {
      for (const condition of this.conditions) {
        if (!condition(entity)) {
          return false;
        }
      }
      return true;
    });
  }

  private applyRelationFilter(entities: EntityRecord[]): EntityRecord[] {
    if (!this.edgeType) return entities;

    const entityIds = new Set(entities.map((e) => e.id));

    return entities.filter((entity) => {
      const relations = this.graph.getRelationsForEntity(entity.id);
      const hasRelation = relations.some((r) => {
        if (r.relationType !== this.edgeType) return false;
        if (!this.relationConditions.length) return true;
        return this.relationConditions.every((cond) => cond(r));
      });
      return hasRelation;
    });
  }

  private applySort(entities: EntityRecord[]): EntityRecord[] {
    if (!this.sortField) return entities;

    const field = this.sortField;
    const direction = this.sortDirection;

    return [...entities].sort((a, b) => {
      let aVal: unknown;
      let bVal: unknown;

      if (field === "name") {
        aVal = a.name;
        bVal = b.name;
      } else if (field === "createdAt") {
        aVal = a.createdAt;
        bVal = b.createdAt;
      } else if (field === "updatedAt") {
        aVal = a.updatedAt;
        bVal = b.updatedAt;
      } else if (field === "version") {
        aVal = a.version;
        bVal = b.version;
      } else {
        aVal = a.properties.get(field);
        bVal = b.properties.get(field);
      }

      if (aVal === undefined && bVal === undefined) return 0;
      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;

      if (typeof aVal === "string" && typeof bVal === "string") {
        const cmp = aVal.localeCompare(bVal);
        return direction === "asc" ? cmp : -cmp;
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }
}
