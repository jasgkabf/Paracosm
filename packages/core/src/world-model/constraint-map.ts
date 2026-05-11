import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { ConstraintType, ConstraintStatus } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import { Constraint } from "./constraint.js";
import type { ConstraintRecord, ConstraintConflict } from "./types.js";

export class ConstraintMap {
  private constraints: Map<string, ConstraintRecord>;
  private entityConstraints: Map<string, Set<string>>;
  private violatedConstraints: Set<string>;
  private priorityOrder: string[];

  constructor() {
    this.constraints = new Map();
    this.entityConstraints = new Map();
    this.violatedConstraints = new Set();
    this.priorityOrder = [];
  }

  addConstraint(params: { name: string; type: ConstraintType; description?: string; expression: string; priority?: number; penalty?: number; scope?: string[]; status?: ConstraintStatus }): Result<ConstraintRecord, ValidationError> {
    const result = Constraint.create(params);
    if (!result.ok) {
      return result;
    }

    const record = result.value;
    this.constraints.set(record.id, record);

    for (const entityId of record.scope) {
      if (!this.entityConstraints.has(entityId)) {
        this.entityConstraints.set(entityId, new Set());
      }
      this.entityConstraints.get(entityId)!.add(record.id);
    }

    this.insertInPriorityOrder(record);
    return ok(record);
  }

  removeConstraint(id: string): Result<true, ValidationError> {
    const constraint = this.constraints.get(id);
    if (!constraint) {
      return err(new ValidationError("Constraint not found", { constraintId: id }));
    }

    for (const entityId of constraint.scope) {
      const entitySet = this.entityConstraints.get(entityId);
      if (entitySet) {
        entitySet.delete(id);
        if (entitySet.size === 0) {
          this.entityConstraints.delete(entityId);
        }
      }
    }

    this.violatedConstraints.delete(id);
    this.constraints.delete(id);
    this.priorityOrder = this.priorityOrder.filter((cid) => cid !== id);

    return ok(true);
  }

  updateConstraint(id: string, updates: Partial<Pick<ConstraintRecord, "name" | "description" | "expression" | "priority" | "penalty" | "status">>): Result<ConstraintRecord, ValidationError> {
    const constraint = this.constraints.get(id);
    if (!constraint) {
      return err(new ValidationError("Constraint not found", { constraintId: id }));
    }

    if (updates.name !== undefined) {
      constraint.name = updates.name;
    }

    if (updates.description !== undefined) {
      constraint.description = updates.description;
    }

    if (updates.expression !== undefined) {
      constraint.expression = updates.expression;
    }

    if (updates.priority !== undefined) {
      if (typeof updates.priority !== "number" || updates.priority < 0) {
        return err(new ValidationError("Priority must be a non-negative number", { field: "priority" }));
      }
      constraint.priority = updates.priority;
      this.priorityOrder = this.priorityOrder.filter((cid) => cid !== id);
      this.insertInPriorityOrder(constraint);
    }

    if (updates.penalty !== undefined) {
      constraint.penalty = updates.penalty;
    }

    if (updates.status !== undefined) {
      constraint.status = updates.status;
      if (updates.status === ConstraintStatus.Violated) {
        this.violatedConstraints.add(id);
      } else if (updates.status === ConstraintStatus.Satisfied) {
        this.violatedConstraints.delete(id);
      }
    }

    constraint.updatedAt = new Date().toISOString();
    constraint.version += 1;

    return ok({ ...constraint });
  }

  checkViolation(entityId: string, action: Record<string, unknown>): Result<Array<{ constraintId: string; constraintName: string; message: string }>, ValidationError> {
    const violations: Array<{ constraintId: string; constraintName: string; message: string }> = [];

    const globalConstraints = this.getGlobalConstraints();
    const entityConstraintIds = this.entityConstraints.get(entityId) ?? new Set();

    const allConstraintIds = new Set<string>();
    for (const c of globalConstraints) {
      allConstraintIds.add(c.id);
    }
    for (const id of entityConstraintIds) {
      allConstraintIds.add(id);
    }

    for (const constraintId of allConstraintIds) {
      const constraint = this.constraints.get(constraintId);
      if (!constraint) continue;
      if (constraint.status === ConstraintStatus.Relaxed) continue;

      const context = { entityId, action, ...action };
      const evaluation = Constraint.evaluate(constraint, context);

      if (evaluation.ok && evaluation.value === ConstraintStatus.Violated) {
        constraint.status = ConstraintStatus.Violated;
        this.violatedConstraints.add(constraintId);

        violations.push({
          constraintId: constraint.id,
          constraintName: constraint.name,
          message: `Constraint "${constraint.name}" violated for entity ${entityId}`,
        });
      } else if (evaluation.ok && evaluation.value === ConstraintStatus.Satisfied) {
        if (constraint.status === ConstraintStatus.Violated) {
          constraint.status = ConstraintStatus.Satisfied;
          this.violatedConstraints.delete(constraintId);
        }
      }
    }

    return ok(violations);
  }

  resolveConflict(constraintAId: string, constraintBId: string, resolution: "prefer_a" | "prefer_b" | "relax_both" | "relax_lower_priority"): Result<true, ValidationError> {
    const a = this.constraints.get(constraintAId);
    const b = this.constraints.get(constraintBId);

    if (!a) {
      return err(new ValidationError("Constraint A not found", { constraintId: constraintAId }));
    }

    if (!b) {
      return err(new ValidationError("Constraint B not found", { constraintId: constraintBId }));
    }

    switch (resolution) {
      case "prefer_a": {
        b.status = ConstraintStatus.Relaxed;
        b.updatedAt = new Date().toISOString();
        b.version += 1;
        this.violatedConstraints.delete(constraintBId);
        break;
      }
      case "prefer_b": {
        a.status = ConstraintStatus.Relaxed;
        a.updatedAt = new Date().toISOString();
        a.version += 1;
        this.violatedConstraints.delete(constraintAId);
        break;
      }
      case "relax_both": {
        a.status = ConstraintStatus.Relaxed;
        a.updatedAt = new Date().toISOString();
        a.version += 1;
        b.status = ConstraintStatus.Relaxed;
        b.updatedAt = new Date().toISOString();
        b.version += 1;
        this.violatedConstraints.delete(constraintAId);
        this.violatedConstraints.delete(constraintBId);
        break;
      }
      case "relax_lower_priority": {
        if (a.priority < b.priority) {
          b.status = ConstraintStatus.Relaxed;
          b.updatedAt = new Date().toISOString();
          b.version += 1;
          this.violatedConstraints.delete(constraintBId);
        } else if (b.priority < a.priority) {
          a.status = ConstraintStatus.Relaxed;
          a.updatedAt = new Date().toISOString();
          a.version += 1;
          this.violatedConstraints.delete(constraintAId);
        } else {
          b.status = ConstraintStatus.Relaxed;
          b.updatedAt = new Date().toISOString();
          b.version += 1;
          this.violatedConstraints.delete(constraintBId);
        }
        break;
      }
    }

    return ok(true);
  }

  detectConflicts(): ConstraintConflict[] {
    const allConstraints = Array.from(this.constraints.values());
    return Constraint.detectConflicts(allConstraints);
  }

  prioritize(): ConstraintRecord[] {
    return this.priorityOrder
      .map((id) => this.constraints.get(id))
      .filter((c): c is ConstraintRecord => c !== undefined);
  }

  getConstraintsForEntity(entityId: string): ConstraintRecord[] {
    const ids = this.entityConstraints.get(entityId) ?? new Set();
    const results: ConstraintRecord[] = [];

    for (const id of ids) {
      const constraint = this.constraints.get(id);
      if (constraint) {
        results.push(constraint);
      }
    }

    for (const constraint of this.constraints.values()) {
      if (constraint.scope.size === 0 && !ids.has(constraint.id)) {
        results.push(constraint);
      }
    }

    return results.sort((a, b) => a.priority - b.priority);
  }

  getViolatedConstraints(): ConstraintRecord[] {
    const results: ConstraintRecord[] = [];
    for (const id of this.violatedConstraints) {
      const constraint = this.constraints.get(id);
      if (constraint) {
        results.push(constraint);
      }
    }
    return results;
  }

  getConstraint(id: string): ConstraintRecord | undefined {
    return this.constraints.get(id);
  }

  mergeConstraints(other: ConstraintMap): Result<true, ValidationError> {
    for (const [id, constraint] of other.constraints) {
      if (this.constraints.has(id)) {
        const existing = this.constraints.get(id)!;
        if (constraint.version > existing.version) {
          this.constraints.set(id, { ...constraint, scope: new Set(constraint.scope) });

          for (const entityId of existing.scope) {
            const entitySet = this.entityConstraints.get(entityId);
            if (entitySet) {
              entitySet.delete(id);
            }
          }

          for (const entityId of constraint.scope) {
            if (!this.entityConstraints.has(entityId)) {
              this.entityConstraints.set(entityId, new Set());
            }
            this.entityConstraints.get(entityId)!.add(id);
          }

          this.priorityOrder = this.priorityOrder.filter((cid) => cid !== id);
          this.insertInPriorityOrder(constraint);
        }
      } else {
        this.constraints.set(id, { ...constraint, scope: new Set(constraint.scope) });

        for (const entityId of constraint.scope) {
          if (!this.entityConstraints.has(entityId)) {
            this.entityConstraints.set(entityId, new Set());
          }
          this.entityConstraints.get(entityId)!.add(id);
        }

        this.insertInPriorityOrder(constraint);
      }
    }

    return ok(true);
  }

  constraintCount(): number {
    return this.constraints.size;
  }

  violatedCount(): number {
    return this.violatedConstraints.size;
  }

  getAllConstraints(): ConstraintRecord[] {
    return Array.from(this.constraints.values());
  }

  clear(): void {
    this.constraints.clear();
    this.entityConstraints.clear();
    this.violatedConstraints.clear();
    this.priorityOrder = [];
  }

  private insertInPriorityOrder(constraint: ConstraintRecord): void {
    let inserted = false;
    for (let i = 0; i < this.priorityOrder.length; i++) {
      const existing = this.constraints.get(this.priorityOrder[i]);
      if (existing && constraint.priority < existing.priority) {
        this.priorityOrder.splice(i, 0, constraint.id);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.priorityOrder.push(constraint.id);
    }
  }

  private getGlobalConstraints(): ConstraintRecord[] {
    const results: ConstraintRecord[] = [];
    for (const constraint of this.constraints.values()) {
      if (constraint.scope.size === 0) {
        results.push(constraint);
      }
    }
    return results;
  }
}
