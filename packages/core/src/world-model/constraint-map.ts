import type { Constraint, ConstraintType } from '@paracosm/shared';
import { generateId, ok, err, type Result } from '@paracosm/shared';
import type { ConstraintViolation, ConflictResolution } from './types.js';

export class ConstraintMap {
  private constraints: Map<string, Constraint> = new Map();
  private activeConstraints: Set<string> = new Set();
  private violatedConstraints: Set<string> = new Set();
  private constraintIndexByType: Map<ConstraintType, Set<string>> = new Map();
  private priorityIndex: Array<{ id: string; priority: number }> = [];
  private dirty: boolean = false;
  private listeners: Array<(event: string, data: unknown) => void> = [];

  on(listener: (event: string, data: unknown) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  private emit(event: string, data: unknown): void {
    for (const listener of this.listeners) {
      listener(event, data);
    }
  }

  private rebuildPriorityIndex(): void {
    if (!this.dirty) return;
    this.priorityIndex = Array.from(this.constraints.values())
      .filter((c) => c.enabled)
      .map((c) => ({ id: c.id, priority: c.priority }))
      .sort((a, b) => b.priority - a.priority);
    this.dirty = false;
  }

  addConstraint(constraint: Omit<Constraint, 'id'> & { id?: string }): Result<Constraint> {
    const id = constraint.id ?? generateId();
    if (this.constraints.has(id)) {
      return err(new Error(`Constraint with id ${id} already exists`));
    }
    const newConstraint: Constraint = { ...constraint, id };
    this.constraints.set(id, newConstraint);
    if (newConstraint.enabled) {
      this.activeConstraints.add(id);
    }
    const typeSet = this.constraintIndexByType.get(newConstraint.type) ?? new Set();
    typeSet.add(id);
    this.constraintIndexByType.set(newConstraint.type, typeSet);
    this.dirty = true;
    this.emit('constraint:added', newConstraint);
    return ok(newConstraint);
  }

  removeConstraint(id: string): Result<boolean> {
    const constraint = this.constraints.get(id);
    if (!constraint) {
      return err(new Error(`Constraint with id ${id} not found`));
    }
    this.constraints.delete(id);
    this.activeConstraints.delete(id);
    this.violatedConstraints.delete(id);
    const typeSet = this.constraintIndexByType.get(constraint.type);
    if (typeSet) {
      typeSet.delete(id);
      if (typeSet.size === 0) this.constraintIndexByType.delete(constraint.type);
    }
    this.dirty = true;
    this.emit('constraint:removed', constraint);
    return ok(true);
  }

  updateConstraint(id: string, updates: Partial<Omit<Constraint, 'id'>>): Result<Constraint> {
    const constraint = this.constraints.get(id);
    if (!constraint) {
      return err(new Error(`Constraint with id ${id} not found`));
    }
    const oldType = constraint.type;
    const updated: Constraint = { ...constraint, ...updates, id };
    this.constraints.set(id, updated);
    if (updates.enabled !== undefined) {
      if (updates.enabled) {
        this.activeConstraints.add(id);
      } else {
        this.activeConstraints.delete(id);
        this.violatedConstraints.delete(id);
      }
    }
    if (updates.type && updates.type !== oldType) {
      const oldSet = this.constraintIndexByType.get(oldType);
      if (oldSet) {
        oldSet.delete(id);
        if (oldSet.size === 0) this.constraintIndexByType.delete(oldType);
      }
      const newSet = this.constraintIndexByType.get(updated.type) ?? new Set();
      newSet.add(id);
      this.constraintIndexByType.set(updated.type, newSet);
    }
    this.dirty = true;
    this.emit('constraint:updated', { before: constraint, after: updated });
    return ok(updated);
  }

  getConstraint(id: string): Constraint | undefined {
    return this.constraints.get(id);
  }

  enableConstraint(id: string): Result<boolean> {
    const result = this.updateConstraint(id, { enabled: true });
    if (!result.ok) return err(result.err);
    return ok(true);
  }

  disableConstraint(id: string): Result<boolean> {
    const result = this.updateConstraint(id, { enabled: false });
    if (!result.ok) return err(result.err);
    return ok(true);
  }

  checkViolation(context: Record<string, unknown>): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    this.rebuildPriorityIndex();
    for (const { id } of this.priorityIndex) {
      const constraint = this.constraints.get(id);
      if (!constraint || !constraint.enabled) continue;
      const violation = this.evaluateConstraint(constraint, context);
      if (violation) {
        violations.push(violation);
        this.violatedConstraints.add(id);
      } else {
        this.violatedConstraints.delete(id);
      }
    }
    return violations;
  }

  resolveConflict(violations: ConstraintViolation[]): ConflictResolution {
    if (violations.length === 0) {
      return { resolved: true, strategy: 'none', adjustments: [], message: 'No conflicts to resolve' };
    }
    const sorted = [...violations].sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.severity] - priorityOrder[a.severity];
    });
    const adjustments: ConflictResolution['adjustments'] = [];
    const resolvedConstraints = new Set<string>();
    for (const violation of sorted) {
      if (resolvedConstraints.has(violation.constraint.id)) continue;
      if (violation.constraint.type === 'hard') {
        adjustments.push({
          entityId: violation.violatingEntity?.id,
          relationId: violation.violatingRelation?.id,
          changes: { action: 'block', reason: violation.message },
        });
        resolvedConstraints.add(violation.constraint.id);
      } else if (violation.constraint.type === 'soft') {
        adjustments.push({
          entityId: violation.violatingEntity?.id,
          relationId: violation.violatingRelation?.id,
          changes: { action: 'warn', reason: violation.message, penalty: violation.constraint.priority * 0.1 },
        });
        resolvedConstraints.add(violation.constraint.id);
      } else if (violation.constraint.type === 'temporal') {
        adjustments.push({
          entityId: violation.violatingEntity?.id,
          changes: { action: 'reschedule', reason: violation.message },
        });
        resolvedConstraints.add(violation.constraint.id);
      } else if (violation.constraint.type === 'resource') {
        adjustments.push({
          entityId: violation.violatingEntity?.id,
          changes: { action: 'throttle', reason: violation.message, limit: violation.constraint.priority },
        });
        resolvedConstraints.add(violation.constraint.id);
      } else {
        adjustments.push({
          entityId: violation.violatingEntity?.id,
          changes: { action: 'review', reason: violation.message },
        });
        resolvedConstraints.add(violation.constraint.id);
      }
    }
    const hasHardViolations = violations.some((v) => v.constraint.type === 'hard');
    return {
      resolved: !hasHardViolations,
      strategy: 'priority_based',
      adjustments,
      message: hasHardViolations
        ? 'Hard constraint violations detected, blocking action'
        : 'Soft/temporal violations resolved with adjustments',
    };
  }

  getActiveConstraints(): Constraint[] {
    return Array.from(this.activeConstraints)
      .map((id) => this.constraints.get(id))
      .filter((c): c is Constraint => c !== undefined);
  }

  getViolatedConstraints(): Constraint[] {
    return Array.from(this.violatedConstraints)
      .map((id) => this.constraints.get(id))
      .filter((c): c is Constraint => c !== undefined);
  }

  getConstraintsByType(type: ConstraintType): Constraint[] {
    const ids = this.constraintIndexByType.get(type);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.constraints.get(id))
      .filter((c): c is Constraint => c !== undefined);
  }

  getConstraintCount(): number {
    return this.constraints.size;
  }

  getActiveCount(): number {
    return this.activeConstraints.size;
  }

  getViolatedCount(): number {
    return this.violatedConstraints.size;
  }

  getAllConstraints(): Constraint[] {
    return Array.from(this.constraints.values());
  }

  clear(): void {
    this.constraints.clear();
    this.activeConstraints.clear();
    this.violatedConstraints.clear();
    this.constraintIndexByType.clear();
    this.priorityIndex = [];
    this.dirty = false;
    this.emit('constraints:cleared', null);
  }

  private evaluateConstraint(constraint: Constraint, context: Record<string, unknown>): ConstraintViolation | null {
    try {
      const expression = constraint.expression;
      const keys = Object.keys(context);
      const values = Object.values(context);
      const fn = new Function(...keys, `return !(${expression})`);
      const violated = fn(...values);
      if (violated) {
        const severity: ConstraintViolation['severity'] =
          constraint.priority >= 8 ? 'high' : constraint.priority >= 4 ? 'medium' : 'low';
        return {
          constraint,
          message: `Constraint "${constraint.name}" violated: ${constraint.description}`,
          severity,
        };
      }
      return null;
    } catch {
      return {
        constraint,
        message: `Constraint "${constraint.name}" could not be evaluated: invalid expression`,
        severity: 'low',
      };
    }
  }
}
