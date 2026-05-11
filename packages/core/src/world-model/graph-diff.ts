import type { Entity, Relation } from '@paracosm/shared';
import { EntityGraph } from './entity-graph.js';
import type { GraphDiffResult } from './types.js';

export class GraphDiff {
  diff(graphA: EntityGraph, graphB: EntityGraph): GraphDiffResult {
    const addedEntities: Entity[] = [];
    const removedEntities: Entity[] = [];
    const modifiedEntities: Array<{ before: Entity; after: Entity }> = [];
    const addedRelations: Relation[] = [];
    const removedRelations: Relation[] = [];
    const modifiedRelations: Array<{ before: Relation; after: Relation }> = [];

    const entitiesA = graphA.getAllEntities();
    const entitiesB = graphB.getAllEntities();
    const relationsA = graphA.getAllRelations();
    const relationsB = graphB.getAllRelations();

    for (const [id, entityB] of entitiesB) {
      const entityA = entitiesA.get(id);
      if (!entityA) {
        addedEntities.push(entityB);
      } else if (this.entityChanged(entityA, entityB)) {
        modifiedEntities.push({ before: entityA, after: entityB });
      }
    }

    for (const [id, entityA] of entitiesA) {
      if (!entitiesB.has(id)) {
        removedEntities.push(entityA);
      }
    }

    for (const [id, relationB] of relationsB) {
      const relationA = relationsA.get(id);
      if (!relationA) {
        addedRelations.push(relationB);
      } else if (this.relationChanged(relationA, relationB)) {
        modifiedRelations.push({ before: relationA, after: relationB });
      }
    }

    for (const [id, relationA] of relationsA) {
      if (!relationsB.has(id)) {
        removedRelations.push(relationA);
      }
    }

    return {
      addedEntities,
      removedEntities,
      modifiedEntities,
      addedRelations,
      removedRelations,
      modifiedRelations,
    };
  }

  applyDiff(target: EntityGraph, diffResult: GraphDiffResult): void {
    for (const entity of diffResult.removedEntities) {
      target.removeEntity(entity.id);
    }
    for (const entity of diffResult.addedEntities) {
      target.addEntity(entity);
    }
    for (const { after } of diffResult.modifiedEntities) {
      target.updateEntity(after.id, after);
    }
    for (const relation of diffResult.removedRelations) {
      target.removeRelation(relation.id);
    }
    for (const relation of diffResult.addedRelations) {
      target.addRelation(relation);
    }
    for (const { after } of diffResult.modifiedRelations) {
      target.updateRelation(after.id, after);
    }
  }

  reverseDiff(diffResult: GraphDiffResult): GraphDiffResult {
    return {
      addedEntities: diffResult.removedEntities,
      removedEntities: diffResult.addedEntities,
      modifiedEntities: diffResult.modifiedEntities.map(({ before, after }) => ({ before: after, after: before })),
      addedRelations: diffResult.removedRelations,
      removedRelations: diffResult.addedRelations,
      modifiedRelations: diffResult.modifiedRelations.map(({ before, after }) => ({ before: after, after: before })),
    };
  }

  isEmpty(diffResult: GraphDiffResult): boolean {
    return (
      diffResult.addedEntities.length === 0 &&
      diffResult.removedEntities.length === 0 &&
      diffResult.modifiedEntities.length === 0 &&
      diffResult.addedRelations.length === 0 &&
      diffResult.removedRelations.length === 0 &&
      diffResult.modifiedRelations.length === 0
    );
  }

  getSummary(diffResult: GraphDiffResult): string {
    const parts: string[] = [];
    if (diffResult.addedEntities.length > 0) parts.push(`+${diffResult.addedEntities.length} entities`);
    if (diffResult.removedEntities.length > 0) parts.push(`-${diffResult.removedEntities.length} entities`);
    if (diffResult.modifiedEntities.length > 0) parts.push(`~${diffResult.modifiedEntities.length} entities`);
    if (diffResult.addedRelations.length > 0) parts.push(`+${diffResult.addedRelations.length} relations`);
    if (diffResult.removedRelations.length > 0) parts.push(`-${diffResult.removedRelations.length} relations`);
    if (diffResult.modifiedRelations.length > 0) parts.push(`~${diffResult.modifiedRelations.length} relations`);
    return parts.length > 0 ? parts.join(', ') : 'No changes';
  }

  private entityChanged(a: Entity, b: Entity): boolean {
    return (
      a.name !== b.name ||
      a.type !== b.type ||
      a.description !== b.description ||
      JSON.stringify(a.attributes) !== JSON.stringify(b.attributes) ||
      JSON.stringify(a.metadata) !== JSON.stringify(b.metadata)
    );
  }

  private relationChanged(a: Relation, b: Relation): boolean {
    return (
      a.sourceId !== b.sourceId ||
      a.targetId !== b.targetId ||
      a.type !== b.type ||
      a.strength !== b.strength ||
      a.description !== b.description ||
      JSON.stringify(a.metadata) !== JSON.stringify(b.metadata)
    );
  }
}
