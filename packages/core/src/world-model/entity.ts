import type { Entity, EntityType } from '@paracosm/shared';
import { generateId } from '@paracosm/shared';

export function createEntity(data: {
  name: string;
  type: EntityType;
  description: string;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  id?: string;
}): Entity {
  const now = new Date();
  return {
    id: data.id ?? generateId(),
    name: data.name,
    type: data.type,
    description: data.description,
    attributes: data.attributes ?? {},
    metadata: data.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
}

export function cloneEntity(entity: Entity, overrides?: Partial<Omit<Entity, 'id' | 'createdAt'>>): Entity {
  return {
    ...entity,
    id: generateId(),
    ...overrides,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function mergeEntityAttributes(
  entity: Entity,
  attributes: Record<string, unknown>,
  strategy: 'replace' | 'merge' | 'append' = 'merge',
): Entity {
  const newAttributes = { ...entity.attributes };
  for (const [key, value] of Object.entries(attributes)) {
    if (strategy === 'replace') {
      newAttributes[key] = value;
    } else if (strategy === 'merge') {
      if (typeof newAttributes[key] === 'object' && typeof value === 'object' && newAttributes[key] !== null && value !== null) {
        newAttributes[key] = { ...(newAttributes[key] as Record<string, unknown>), ...value };
      } else {
        newAttributes[key] = value;
      }
    } else if (strategy === 'append') {
      if (Array.isArray(newAttributes[key]) && Array.isArray(value)) {
        newAttributes[key] = [...(newAttributes[key] as unknown[]), ...value];
      } else {
        newAttributes[key] = value;
      }
    }
  }
  return { ...entity, attributes: newAttributes, updatedAt: new Date() };
}

export function validateEntity(entity: Partial<Entity>): string[] {
  const errors: string[] = [];
  if (!entity.name || entity.name.trim().length === 0) {
    errors.push('Entity name is required');
  }
  if (!entity.type) {
    errors.push('Entity type is required');
  }
  if (entity.name && entity.name.length > 500) {
    errors.push('Entity name must be less than 500 characters');
  }
  if (entity.description && entity.description.length > 10000) {
    errors.push('Entity description must be less than 10000 characters');
  }
  return errors;
}
