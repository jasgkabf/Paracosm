import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import { Entity } from "./entity.js";
import type { EntityRecord, RelationRecord, GraphDiff as GraphDiffType } from "./types.js";

export class GraphDiff {
  static diff(
    baseEntities: Map<string, EntityRecord>,
    baseRelations: Map<string, RelationRecord>,
    otherEntities: Map<string, EntityRecord>,
    otherRelations: Map<string, RelationRecord>
  ): GraphDiffType {
    const result: GraphDiffType = {
      addedNodes: [],
      removedNodes: [],
      modifiedNodes: [],
      addedEdges: [],
      removedEdges: [],
      modifiedEdges: [],
    };

    for (const [id, entity] of otherEntities) {
      if (!baseEntities.has(id)) {
        result.addedNodes.push(entityToGraphNode(entity));
      } else {
        const baseEntity = baseEntities.get(id)!;
        const diffs = Entity.diff(baseEntity, entity);
        if (diffs.length > 0) {
          result.modifiedNodes.push({
            id,
            before: entityToGraphNode(baseEntity),
            after: entityToGraphNode(entity),
          });
        }
      }
    }

    for (const [id, entity] of baseEntities) {
      if (!otherEntities.has(id)) {
        result.removedNodes.push(id);
      }
    }

    for (const [id, relation] of otherRelations) {
      if (!baseRelations.has(id)) {
        result.addedEdges.push(relationToGraphEdge(relation));
      } else {
        const baseRelation = baseRelations.get(id)!;
        if (
          baseRelation.sourceId !== relation.sourceId ||
          baseRelation.targetId !== relation.targetId ||
          baseRelation.relationType !== relation.relationType ||
          baseRelation.label !== relation.label ||
          baseRelation.weight !== relation.weight ||
          baseRelation.bidirectional !== relation.bidirectional
        ) {
          result.modifiedEdges.push({
            id,
            before: relationToGraphEdge(baseRelation),
            after: relationToGraphEdge(relation),
          });
        }
      }
    }

    for (const [id] of baseRelations) {
      if (!otherRelations.has(id)) {
        result.removedEdges.push(id);
      }
    }

    return result;
  }

  static patch(
    entities: Map<string, EntityRecord>,
    relations: Map<string, RelationRecord>,
    graphDiff: GraphDiffType
  ): Result<{ entities: Map<string, EntityRecord>; relations: Map<string, RelationRecord> }, ValidationError> {
    const patchedEntities = new Map<string, EntityRecord>();
    for (const [id, entity] of entities) {
      patchedEntities.set(id, Entity.clone(entity));
    }

    const patchedRelations = new Map<string, RelationRecord>();
    for (const [id, relation] of relations) {
      patchedRelations.set(id, { ...relation, properties: new Map(relation.properties) });
    }

    for (const nodeId of graphDiff.removedNodes) {
      patchedEntities.delete(nodeId);

      const relationsToRemove: string[] = [];
      for (const [relId, rel] of patchedRelations) {
        if (rel.sourceId === nodeId || rel.targetId === nodeId) {
          relationsToRemove.push(relId);
        }
      }
      for (const relId of relationsToRemove) {
        patchedRelations.delete(relId);
      }
    }

    for (const edgeId of graphDiff.removedEdges) {
      patchedRelations.delete(edgeId);
    }

    for (const modification of graphDiff.modifiedNodes) {
      const entity = patchedEntities.get(modification.id);
      if (entity) {
        const afterData = modification.after.data;
        if (afterData && typeof afterData === "object") {
          for (const [key, value] of Object.entries(afterData)) {
            entity.properties.set(key, value);
          }
        }
        entity.name = modification.after.label;
        entity.updatedAt = modification.after.updatedAt;
        entity.version += 1;
      }
    }

    for (const modification of graphDiff.modifiedEdges) {
      const relation = patchedRelations.get(modification.id);
      if (relation) {
        relation.sourceId = modification.after.sourceId;
        relation.targetId = modification.after.targetId;
        relation.relationType = modification.after.type;
        relation.label = modification.after.label;
        relation.weight = modification.after.weight;
        relation.bidirectional = modification.after.bidirectional;
        relation.updatedAt = modification.after.updatedAt;
        relation.version += 1;
      }
    }

    for (const node of graphDiff.addedNodes) {
      const properties = new Map<string, unknown>();
      if (node.data && typeof node.data === "object") {
        for (const [key, value] of Object.entries(node.data)) {
          properties.set(key, value);
        }
      }

      const entity: EntityRecord = {
        id: node.id,
        entityType: node.type,
        name: node.label,
        description: "",
        properties,
        tags: new Set(),
        metadata: {},
        parentId: null,
        childIds: new Set(),
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        version: 1,
      };

      patchedEntities.set(entity.id, entity);
    }

    for (const edge of graphDiff.addedEdges) {
      const properties = new Map<string, unknown>();
      if (edge.data && typeof edge.data === "object") {
        for (const [key, value] of Object.entries(edge.data)) {
          properties.set(key, value);
        }
      }

      const relation: RelationRecord = {
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        relationType: edge.type,
        label: edge.label,
        weight: edge.weight,
        bidirectional: edge.bidirectional,
        properties,
        createdAt: edge.createdAt,
        updatedAt: edge.updatedAt,
        version: 1,
      };

      patchedRelations.set(relation.id, relation);
    }

    return ok({ entities: patchedEntities, relations: patchedRelations });
  }

  static merge(
    baseEntities: Map<string, EntityRecord>,
    baseRelations: Map<string, RelationRecord>,
    branchAEntities: Map<string, EntityRecord>,
    branchARelations: Map<string, RelationRecord>,
    branchBEntities: Map<string, EntityRecord>,
    branchBRelations: Map<string, RelationRecord>
  ): Result<{ entities: Map<string, EntityRecord>; relations: Map<string, RelationRecord>; conflicts: Array<{ id: string; type: "entity" | "relation"; description: string }> }, ValidationError> {
    const mergedEntities = new Map<string, EntityRecord>();
    const mergedRelations = new Map<string, RelationRecord>();
    const conflicts: Array<{ id: string; type: "entity" | "relation"; description: string }> = [];

    const diffA = GraphDiff.diff(baseEntities, baseRelations, branchAEntities, branchARelations);
    const diffB = GraphDiff.diff(baseEntities, baseRelations, branchBEntities, branchBRelations);

    for (const [id, entity] of baseEntities) {
      mergedEntities.set(id, Entity.clone(entity));
    }

    for (const [id, relation] of baseRelations) {
      mergedRelations.set(id, { ...relation, properties: new Map(relation.properties) });
    }

    for (const node of diffA.addedNodes) {
      if (!mergedEntities.has(node.id)) {
        const properties = new Map<string, unknown>();
        if (node.data && typeof node.data === "object") {
          for (const [key, value] of Object.entries(node.data)) {
            properties.set(key, value);
          }
        }
        mergedEntities.set(node.id, {
          id: node.id,
          entityType: node.type,
          name: node.label,
          description: "",
          properties,
          tags: new Set(),
          metadata: {},
          parentId: null,
          childIds: new Set(),
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
          version: 1,
        });
      }
    }

    for (const node of diffB.addedNodes) {
      if (!mergedEntities.has(node.id)) {
        const properties = new Map<string, unknown>();
        if (node.data && typeof node.data === "object") {
          for (const [key, value] of Object.entries(node.data)) {
            properties.set(key, value);
          }
        }
        mergedEntities.set(node.id, {
          id: node.id,
          entityType: node.type,
          name: node.label,
          description: "",
          properties,
          tags: new Set(),
          metadata: {},
          parentId: null,
          childIds: new Set(),
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
          version: 1,
        });
      } else if (diffA.addedNodes.some((n) => n.id === node.id)) {
        conflicts.push({
          id: node.id,
          type: "entity",
          description: `Both branches added entity "${node.id}"`,
        });
      }
    }

    const modifiedAById = new Map(diffA.modifiedNodes.map((m) => [m.id, m]));
    const modifiedBById = new Map(diffB.modifiedNodes.map((m) => [m.id, m]));

    for (const [id, modA] of modifiedAById) {
      if (modifiedBById.has(id)) {
        const modB = modifiedBById.get(id)!;
        if (JSON.stringify(modA.after) !== JSON.stringify(modB.after)) {
          conflicts.push({
            id,
            type: "entity",
            description: `Both branches modified entity "${id}" differently`,
          });

          const entityA = branchAEntities.get(id);
          if (entityA) {
            mergedEntities.set(id, Entity.clone(entityA));
          }
        } else {
          const entityA = branchAEntities.get(id);
          if (entityA) {
            mergedEntities.set(id, Entity.clone(entityA));
          }
        }
      } else {
        const entityA = branchAEntities.get(id);
        if (entityA) {
          mergedEntities.set(id, Entity.clone(entityA));
        }
      }
    }

    for (const [id, modB] of modifiedBById) {
      if (!modifiedAById.has(id)) {
        const entityB = branchBEntities.get(id);
        if (entityB) {
          mergedEntities.set(id, Entity.clone(entityB));
        }
      }
    }

    const removedASet = new Set(diffA.removedNodes);
    const removedBSet = new Set(diffB.removedNodes);

    for (const id of removedASet) {
      if (modifiedBById.has(id)) {
        conflicts.push({
          id,
          type: "entity",
          description: `Branch A removed entity "${id}" but branch B modified it`,
        });
      } else {
        mergedEntities.delete(id);
      }
    }

    for (const id of removedBSet) {
      if (!removedASet.has(id)) {
        if (modifiedAById.has(id)) {
          conflicts.push({
            id,
            type: "entity",
            description: `Branch B removed entity "${id}" but branch A modified it`,
          });
        } else {
          mergedEntities.delete(id);
        }
      }
    }

    for (const edge of diffA.addedEdges) {
      if (!mergedRelations.has(edge.id)) {
        const properties = new Map<string, unknown>();
        if (edge.data && typeof edge.data === "object") {
          for (const [key, value] of Object.entries(edge.data)) {
            properties.set(key, value);
          }
        }
        mergedRelations.set(edge.id, {
          id: edge.id,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          relationType: edge.type,
          label: edge.label,
          weight: edge.weight,
          bidirectional: edge.bidirectional,
          properties,
          createdAt: edge.createdAt,
          updatedAt: edge.updatedAt,
          version: 1,
        });
      }
    }

    for (const edge of diffB.addedEdges) {
      if (!mergedRelations.has(edge.id)) {
        const properties = new Map<string, unknown>();
        if (edge.data && typeof edge.data === "object") {
          for (const [key, value] of Object.entries(edge.data)) {
            properties.set(key, value);
          }
        }
        mergedRelations.set(edge.id, {
          id: edge.id,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          relationType: edge.type,
          label: edge.label,
          weight: edge.weight,
          bidirectional: edge.bidirectional,
          properties,
          createdAt: edge.createdAt,
          updatedAt: edge.updatedAt,
          version: 1,
        });
      }
    }

    for (const edgeId of diffA.removedEdges) {
      mergedRelations.delete(edgeId);
    }

    for (const edgeId of diffB.removedEdges) {
      mergedRelations.delete(edgeId);
    }

    for (const mod of diffA.modifiedEdges) {
      const relA = branchARelations.get(mod.id);
      if (relA) {
        mergedRelations.set(mod.id, { ...relA, properties: new Map(relA.properties) });
      }
    }

    for (const mod of diffB.modifiedEdges) {
      const relB = branchBRelations.get(mod.id);
      if (relB && !diffA.modifiedEdges.some((m) => m.id === mod.id)) {
        mergedRelations.set(mod.id, { ...relB, properties: new Map(relB.properties) });
      } else if (relB && diffA.modifiedEdges.some((m) => m.id === mod.id)) {
        conflicts.push({
          id: mod.id,
          type: "relation",
          description: `Both branches modified relation "${mod.id}" differently`,
        });
      }
    }

    return ok({ entities: mergedEntities, relations: mergedRelations, conflicts });
  }
}

function entityToGraphNode(entity: EntityRecord): import("./types.js").GraphNode {
  const data: Record<string, unknown> = {};
  for (const [key, value] of entity.properties) {
    data[key] = value;
  }
  return {
    id: entity.id,
    type: entity.entityType,
    label: entity.name,
    data,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

function relationToGraphEdge(relation: RelationRecord): import("./types.js").GraphEdge {
  const data: Record<string, unknown> = {};
  for (const [key, value] of relation.properties) {
    data[key] = value;
  }
  return {
    id: relation.id,
    sourceId: relation.sourceId,
    targetId: relation.targetId,
    type: relation.relationType,
    label: relation.label,
    weight: relation.weight,
    bidirectional: relation.bidirectional,
    data,
    createdAt: relation.createdAt,
    updatedAt: relation.updatedAt,
  };
}
