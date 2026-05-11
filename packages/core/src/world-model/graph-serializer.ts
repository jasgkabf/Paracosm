import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { hash } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import type { EntityRecord, RelationRecord, GraphNode, GraphEdge, SerializedGraph } from "./types.js";
import { SERIALIZATION_VERSION } from "./types.js";

export class GraphSerializer {
  static serializeToJSON(
    entities: Map<string, EntityRecord>,
    relations: Map<string, RelationRecord>
  ): Result<string, ValidationError> {
    try {
      const nodes: Array<[string, GraphNode]> = [];
      for (const [id, entity] of entities) {
        const data: Record<string, unknown> = {};
        for (const [key, value] of entity.properties) {
          data[key] = value;
        }
        nodes.push([id, {
          id: entity.id,
          type: entity.entityType,
          label: entity.name,
          data,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
        }]);
      }

      const edges: Array<[string, GraphEdge]> = [];
      for (const [id, relation] of relations) {
        const data: Record<string, unknown> = {};
        for (const [key, value] of relation.properties) {
          data[key] = value;
        }
        edges.push([id, {
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
        }]);
      }

      const serialized: SerializedGraph = {
        version: SERIALIZATION_VERSION,
        nodes,
        edges,
        metadata: {
          createdAt: new Date().toISOString(),
          entityCount: entities.size,
          relationCount: relations.size,
        },
      };

      const json = JSON.stringify(serialized);
      return ok(json);
    } catch (error) {
      return err(new ValidationError("Failed to serialize graph to JSON", {
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  static deserializeFromJSON(json: string): Result<{ entities: Map<string, EntityRecord>; relations: Map<string, RelationRecord> }, ValidationError> {
    try {
      const parsed = JSON.parse(json) as SerializedGraph;

      if (!parsed.version || typeof parsed.version !== "number") {
        return err(new ValidationError("Invalid serialization format: missing version"));
      }

      const migrated = GraphSerializer.migrateSerialized(parsed);
      if (!migrated.ok) return migrated;

      const data = migrated.value;

      const entities = new Map<string, EntityRecord>();
      if (data.nodes && Array.isArray(data.nodes)) {
        for (const [id, node] of data.nodes) {
          if (!id || !node) continue;

          const properties = new Map<string, unknown>();
          if (node.data && typeof node.data === "object") {
            for (const [key, value] of Object.entries(node.data)) {
              properties.set(key, value);
            }
          }

          const entity: EntityRecord = {
            id: node.id ?? id,
            entityType: node.type,
            name: node.label ?? "",
            description: "",
            properties,
            tags: new Set(),
            metadata: {},
            parentId: null,
            childIds: new Set(),
            createdAt: node.createdAt ?? new Date().toISOString(),
            updatedAt: node.updatedAt ?? new Date().toISOString(),
            version: 1,
          };

          entities.set(entity.id, entity);
        }
      }

      const relations = new Map<string, RelationRecord>();
      if (data.edges && Array.isArray(data.edges)) {
        for (const [id, edge] of data.edges) {
          if (!id || !edge) continue;

          const properties = new Map<string, unknown>();
          if (edge.data && typeof edge.data === "object") {
            for (const [key, value] of Object.entries(edge.data)) {
              properties.set(key, value);
            }
          }

          const relation: RelationRecord = {
            id: edge.id ?? id,
            sourceId: edge.sourceId,
            targetId: edge.targetId,
            relationType: edge.type,
            label: edge.label ?? edge.type,
            weight: edge.weight ?? 1.0,
            bidirectional: edge.bidirectional ?? false,
            properties,
            createdAt: edge.createdAt ?? new Date().toISOString(),
            updatedAt: edge.updatedAt ?? new Date().toISOString(),
            version: 1,
          };

          relations.set(relation.id, relation);
        }
      }

      return ok({ entities, relations });
    } catch (error) {
      return err(new ValidationError("Failed to deserialize graph from JSON", {
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  static serializeToBinary(
    entities: Map<string, EntityRecord>,
    relations: Map<string, RelationRecord>
  ): Result<Buffer, ValidationError> {
    try {
      const jsonResult = GraphSerializer.serializeToJSON(entities, relations);
      if (!jsonResult.ok) return jsonResult;

      const jsonStr = jsonResult.value;

      const header = Buffer.alloc(12);
      header.writeUInt32BE(0x50434D47, 0);
      header.writeUInt32BE(SERIALIZATION_VERSION, 4);
      header.writeUInt32BE(jsonStr.length, 8);

      const payload = Buffer.from(jsonStr, "utf8");
      const buffer = Buffer.concat([header, payload]);

      return ok(buffer);
    } catch (error) {
      return err(new ValidationError("Failed to serialize graph to binary", {
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  static deserializeFromBinary(buffer: Buffer): Result<{ entities: Map<string, EntityRecord>; relations: Map<string, RelationRecord> }, ValidationError> {
    try {
      if (buffer.length < 12) {
        return err(new ValidationError("Binary data too short: missing header"));
      }

      const magic = buffer.readUInt32BE(0);
      if (magic !== 0x50434D47) {
        return err(new ValidationError("Invalid binary format: bad magic number", {
          expected: "0x50434D47",
          actual: `0x${magic.toString(16)}`,
        }));
      }

      const version = buffer.readUInt32BE(4);
      if (version > SERIALIZATION_VERSION) {
        return err(new ValidationError("Unsupported serialization version", {
          supported: SERIALIZATION_VERSION,
          found: version,
        }));
      }

      const payloadLength = buffer.readUInt32BE(8);
      if (buffer.length < 12 + payloadLength) {
        return err(new ValidationError("Binary data truncated: payload shorter than expected", {
          expected: payloadLength,
          available: buffer.length - 12,
        }));
      }

      const jsonStr = buffer.subarray(12, 12 + payloadLength).toString("utf8");
      return GraphSerializer.deserializeFromJSON(jsonStr);
    } catch (error) {
      return err(new ValidationError("Failed to deserialize graph from binary", {
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  static computeChecksum(
    entities: Map<string, EntityRecord>,
    relations: Map<string, RelationRecord>
  ): string {
    const entityIds = Array.from(entities.keys()).sort().join(",");
    const relationIds = Array.from(relations.keys()).sort().join(",");
    const raw = `${entityIds}|${relationIds}`;
    return hash(raw);
  }

  private static migrateSerialized(data: SerializedGraph): Result<SerializedGraph, ValidationError> {
    let current = { ...data };

    while (current.version < SERIALIZATION_VERSION) {
      const nextVersion = current.version + 1;

      switch (nextVersion) {
        case 1:
          current = GraphSerializer.migrateToV1(current);
          break;
        default:
          return err(new ValidationError(`Unknown serialization version: ${nextVersion}`, {
            currentVersion: current.version,
          }));
      }
    }

    return ok(current);
  }

  private static migrateToV1(data: SerializedGraph): SerializedGraph {
    const migrated = { ...data, version: 1 };

    if (!migrated.nodes) migrated.nodes = [];
    if (!migrated.edges) migrated.edges = [];
    if (!migrated.metadata) {
      migrated.metadata = {
        createdAt: new Date().toISOString(),
        entityCount: migrated.nodes.length,
        relationCount: migrated.edges.length,
      };
    }

    return migrated;
  }
}
