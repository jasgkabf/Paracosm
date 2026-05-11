import type { Constraint, ConstraintType } from '@paracosm/shared';
import { generateId } from '@paracosm/shared';

export function createConstraint(data: {
  name: string;
  type: ConstraintType;
  expression: string;
  description?: string;
  priority?: number;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
  id?: string;
}): Constraint {
  return {
    id: data.id ?? generateId(),
    name: data.name,
    type: data.type,
    expression: data.expression,
    description: data.description ?? '',
    priority: data.priority ?? 5,
    enabled: data.enabled ?? true,
    metadata: data.metadata ?? {},
  };
}

export function validateConstraint(constraint: Partial<Constraint>): string[] {
  const errors: string[] = [];
  if (!constraint.name || constraint.name.trim().length === 0) {
    errors.push('Constraint name is required');
  }
  if (!constraint.type) {
    errors.push('Constraint type is required');
  }
  if (!constraint.expression || constraint.expression.trim().length === 0) {
    errors.push('Constraint expression is required');
  }
  if (constraint.priority !== undefined && (constraint.priority < 0 || constraint.priority > 10)) {
    errors.push('Constraint priority must be between 0 and 10');
  }
  try {
    new Function(constraint.expression ?? '');
  } catch {
    errors.push('Constraint expression is not valid JavaScript');
  }
  return errors;
}

export function evaluateConstraint(expression: string, context: Record<string, unknown>): boolean {
  try {
    const keys = Object.keys(context);
    const values = Object.values(context);
    const fn = new Function(...keys, `return !!(${expression})`);
    return fn(...values);
  } catch {
    return false;
  }
}
