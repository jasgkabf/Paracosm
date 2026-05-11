import type { Relation, RelationType } from '@paracosm/shared';
import { generateId } from '@paracosm/shared';

export function createRelation(data: {
  sourceId: string;
  targetId: string;
  type: RelationType;
  strength?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  id?: string;
}): Relation {
  return {
    id: data.id ?? generateId(),
    sourceId: data.sourceId,
    targetId: data.targetId,
    type: data.type,
    strength: data.strength ?? 1.0,
    description: data.description ?? '',
    metadata: data.metadata ?? {},
    createdAt: new Date(),
  };
}

export function invertRelation(relation: Relation): Relation {
  const inverseTypeMap: Partial<Record<RelationType, RelationType>> = {
    depends_on: 'supports',
    supports: 'depends_on',
    contains: 'belongs_to',
    belongs_to: 'contains',
    produces: 'consumes',
    consumes: 'produces',
    influences: 'influences',
    conflicts_with: 'conflicts_with',
    interacts_with: 'interacts_with',
    requires: 'supports',
  };
  return {
    ...relation,
    id: generateId(),
    sourceId: relation.targetId,
    targetId: relation.sourceId,
    type: inverseTypeMap[relation.type] ?? relation.type,
    createdAt: new Date(),
  };
}

export function validateRelation(relation: Partial<Relation>): string[] {
  const errors: string[] = [];
  if (!relation.sourceId) {
    errors.push('Source entity ID is required');
  }
  if (!relation.targetId) {
    errors.push('Target entity ID is required');
  }
  if (relation.sourceId === relation.targetId) {
    errors.push('Self-referencing relations are not allowed');
  }
  if (!relation.type) {
    errors.push('Relation type is required');
  }
  if (relation.strength !== undefined && (relation.strength < 0 || relation.strength > 1)) {
    errors.push('Relation strength must be between 0 and 1');
  }
  return errors;
}

export function computeRelationStrength(relation: Relation, context?: Record<string, unknown>): number {
  let strength = relation.strength;
  if (context) {
    const recency = context.recency as number | undefined;
    if (recency !== undefined) {
      strength *= Math.exp(-recency * 0.01);
    }
    const frequency = context.frequency as number | undefined;
    if (frequency !== undefined) {
      strength *= Math.min(1 + frequency * 0.1, 2.0);
    }
  }
  return Math.min(Math.max(strength, 0), 1);
}
