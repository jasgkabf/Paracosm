import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { GoalPriority, GoalState } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import { Goal } from "./goal.js";
import type { GoalRecord, GoalDependency } from "./types.js";

export class GoalStack {
  private goals: Map<string, GoalRecord>;
  private activeGoals: Set<string>;
  private completedGoals: Set<string>;
  private failedGoals: Set<string>;
  private deferredGoals: Set<string>;
  private stackOrder: string[];

  constructor() {
    this.goals = new Map();
    this.activeGoals = new Set();
    this.completedGoals = new Set();
    this.failedGoals = new Set();
    this.deferredGoals = new Set();
    this.stackOrder = [];
  }

  pushGoal(params: { name: string; description?: string; priority?: GoalPriority; successCriteria?: string; progress?: number; deadline?: string | null; assigneeId?: string | null; parentGoalId?: string | null }): Result<GoalRecord, ValidationError> {
    if (params.parentGoalId) {
      const parent = this.goals.get(params.parentGoalId);
      if (!parent) {
        return err(new ValidationError("Parent goal not found", { parentGoalId: params.parentGoalId }));
      }
    }

    const result = Goal.create(params);
    if (!result.ok) {
      return result;
    }

    const record = result.value;
    this.goals.set(record.id, record);
    this.activeGoals.add(record.id);
    this.insertInStackOrder(record);

    if (record.parentGoalId) {
      const parent = this.goals.get(record.parentGoalId);
      if (parent) {
        parent.subGoalIds.add(record.id);
        parent.updatedAt = new Date().toISOString();
      }
    }

    return ok(record);
  }

  popGoal(): Result<GoalRecord, ValidationError> {
    if (this.stackOrder.length === 0) {
      return err(new ValidationError("Goal stack is empty"));
    }

    const topId = this.stackOrder[0];
    return this.resolve(topId, GoalState.Completed);
  }

  decompose(goalId: string, subGoalNames: string[]): Result<GoalRecord[], ValidationError> {
    const goal = this.goals.get(goalId);
    if (!goal) {
      return err(new ValidationError("Goal not found", { goalId }));
    }

    if (goal.state !== GoalState.Active && goal.state !== GoalState.Pending) {
      return err(new ValidationError("Can only decompose active or pending goals", {
        goalId,
        currentState: goal.state,
      }));
    }

    const result = Goal.decompose(goal, subGoalNames);
    if (!result.ok) {
      return result;
    }

    const [updatedParent, ...subGoals] = result.value;
    this.goals.set(goalId, updatedParent);

    for (const subGoal of subGoals) {
      this.goals.set(subGoal.id, subGoal);
      this.activeGoals.add(subGoal.id);
      this.insertInStackOrder(subGoal);
    }

    goal.state = GoalState.InProgress;
    goal.updatedAt = new Date().toISOString();

    return ok([updatedParent, ...subGoals]);
  }

  prioritize(goalIds?: string[]): Result<GoalRecord[], ValidationError> {
    if (goalIds) {
      for (const id of goalIds) {
        if (!this.goals.has(id)) {
          return err(new ValidationError("Goal not found", { goalId: id }));
        }
      }

      this.stackOrder = [...goalIds];

      const remaining = Array.from(this.goals.keys()).filter(
        (id) => !goalIds.includes(id) && this.activeGoals.has(id)
      );

      const remainingSorted = remaining.sort((a, b) => {
        const goalA = this.goals.get(a)!;
        const goalB = this.goals.get(b)!;
        return goalA.priority - goalB.priority;
      });

      this.stackOrder = [...this.stackOrder, ...remainingSorted];
    } else {
      this.stackOrder.sort((a, b) => {
        const goalA = this.goals.get(a);
        const goalB = this.goals.get(b);
        if (!goalA || !goalB) return 0;
        return goalA.priority - goalB.priority;
      });
    }

    return ok(this.getActiveGoals());
  }

  checkDependency(goalId: string): GoalDependency {
    const goal = this.goals.get(goalId);
    if (!goal) {
      return { goalId, dependsOn: [], satisfied: false };
    }

    return Goal.checkDependencies(goal, this.goals);
  }

  resolve(goalId: string, state: GoalState.Completed | GoalState.Failed | GoalState.Cancelled): Result<GoalRecord, ValidationError> {
    const goal = this.goals.get(goalId);
    if (!goal) {
      return err(new ValidationError("Goal not found", { goalId }));
    }

    if (!this.activeGoals.has(goalId) && !this.deferredGoals.has(goalId)) {
      return err(new ValidationError("Goal is not active or deferred", {
        goalId,
        currentState: goal.state,
      }));
    }

    goal.state = state;
    goal.updatedAt = new Date().toISOString();
    goal.version += 1;

    this.activeGoals.delete(goalId);
    this.deferredGoals.delete(goalId);
    this.stackOrder = this.stackOrder.filter((id) => id !== goalId);

    if (state === GoalState.Completed) {
      goal.progress = 100;
      this.completedGoals.add(goalId);
    } else if (state === GoalState.Failed) {
      this.failedGoals.add(goalId);
    }

    if (goal.parentGoalId) {
      this.updateParentProgress(goal.parentGoalId);
    }

    return ok(Goal.clone(goal));
  }

  defer(goalId: string): Result<GoalRecord, ValidationError> {
    const goal = this.goals.get(goalId);
    if (!goal) {
      return err(new ValidationError("Goal not found", { goalId }));
    }

    if (!this.activeGoals.has(goalId)) {
      return err(new ValidationError("Only active goals can be deferred", {
        goalId,
        currentState: goal.state,
      }));
    }

    goal.state = GoalState.Deferred;
    goal.updatedAt = new Date().toISOString();
    goal.version += 1;

    this.activeGoals.delete(goalId);
    this.deferredGoals.add(goalId);
    this.stackOrder = this.stackOrder.filter((id) => id !== goalId);

    return ok(Goal.clone(goal));
  }

  reactivate(goalId: string): Result<GoalRecord, ValidationError> {
    const goal = this.goals.get(goalId);
    if (!goal) {
      return err(new ValidationError("Goal not found", { goalId }));
    }

    if (!this.deferredGoals.has(goalId)) {
      return err(new ValidationError("Only deferred goals can be reactivated", {
        goalId,
        currentState: goal.state,
      }));
    }

    goal.state = GoalState.Active;
    goal.updatedAt = new Date().toISOString();
    goal.version += 1;

    this.deferredGoals.delete(goalId);
    this.activeGoals.add(goalId);
    this.insertInStackOrder(goal);

    return ok(Goal.clone(goal));
  }

  updateProgress(goalId: string, progress: number): Result<GoalRecord, ValidationError> {
    const goal = this.goals.get(goalId);
    if (!goal) {
      return err(new ValidationError("Goal not found", { goalId }));
    }

    if (typeof progress !== "number" || progress < 0 || progress > 100) {
      return err(new ValidationError("Progress must be between 0 and 100", {
        goalId,
        progress,
      }));
    }

    goal.progress = progress;
    goal.updatedAt = new Date().toISOString();
    goal.version += 1;

    if (progress === 100 && goal.state !== GoalState.Completed) {
      return this.resolve(goalId, GoalState.Completed);
    }

    if (progress > 0 && goal.state === GoalState.Pending) {
      goal.state = GoalState.InProgress;
    }

    if (goal.parentGoalId) {
      this.updateParentProgress(goal.parentGoalId);
    }

    return ok(Goal.clone(goal));
  }

  getActiveGoals(): GoalRecord[] {
    const results: GoalRecord[] = [];
    for (const id of this.stackOrder) {
      if (this.activeGoals.has(id)) {
        const goal = this.goals.get(id);
        if (goal) results.push(goal);
      }
    }
    return results;
  }

  getBlockedGoals(): GoalRecord[] {
    const blocked: GoalRecord[] = [];
    for (const [id, goal] of this.goals) {
      if (!this.activeGoals.has(id)) continue;

      const dep = Goal.checkDependencies(goal, this.goals);
      if (!dep.satisfied) {
        blocked.push(goal);
      }
    }
    return blocked;
  }

  getCompletedGoals(): GoalRecord[] {
    const results: GoalRecord[] = [];
    for (const id of this.completedGoals) {
      const goal = this.goals.get(id);
      if (goal) results.push(goal);
    }
    return results;
  }

  getFailedGoals(): GoalRecord[] {
    const results: GoalRecord[] = [];
    for (const id of this.failedGoals) {
      const goal = this.goals.get(id);
      if (goal) results.push(goal);
    }
    return results;
  }

  getDeferredGoals(): GoalRecord[] {
    const results: GoalRecord[] = [];
    for (const id of this.deferredGoals) {
      const goal = this.goals.get(id);
      if (goal) results.push(goal);
    }
    return results;
  }

  getGoal(id: string): GoalRecord | undefined {
    return this.goals.get(id);
  }

  getSubGoals(goalId: string): GoalRecord[] {
    const goal = this.goals.get(goalId);
    if (!goal) return [];

    const results: GoalRecord[] = [];
    for (const subId of goal.subGoalIds) {
      const subGoal = this.goals.get(subId);
      if (subGoal) results.push(subGoal);
    }
    return results;
  }

  goalCount(): number {
    return this.goals.size;
  }

  activeCount(): number {
    return this.activeGoals.size;
  }

  completedCount(): number {
    return this.completedGoals.size;
  }

  failedCount(): number {
    return this.failedGoals.size;
  }

  estimateComplexity(goalId: string): number {
    const goal = this.goals.get(goalId);
    if (!goal) return 0;
    return Goal.estimateComplexity(goal, this.goals);
  }

  getAllGoals(): GoalRecord[] {
    return Array.from(this.goals.values());
  }

  clear(): void {
    this.goals.clear();
    this.activeGoals.clear();
    this.completedGoals.clear();
    this.failedGoals.clear();
    this.deferredGoals.clear();
    this.stackOrder = [];
  }

  private insertInStackOrder(goal: GoalRecord): void {
    let inserted = false;
    for (let i = 0; i < this.stackOrder.length; i++) {
      const existingGoal = this.goals.get(this.stackOrder[i]);
      if (existingGoal && goal.priority < existingGoal.priority) {
        this.stackOrder.splice(i, 0, goal.id);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.stackOrder.push(goal.id);
    }
  }

  private updateParentProgress(parentGoalId: string): void {
    const parent = this.goals.get(parentGoalId);
    if (!parent || parent.subGoalIds.size === 0) return;

    let totalProgress = 0;
    let subGoalCount = 0;

    for (const subId of parent.subGoalIds) {
      const subGoal = this.goals.get(subId);
      if (subGoal) {
        totalProgress += subGoal.progress;
        subGoalCount++;
      }
    }

    if (subGoalCount > 0) {
      parent.progress = Math.round(totalProgress / subGoalCount);
      parent.updatedAt = new Date().toISOString();

      if (parent.progress === 100 && parent.state !== GoalState.Completed) {
        parent.state = GoalState.Completed;
        this.activeGoals.delete(parentGoalId);
        this.completedGoals.add(parentGoalId);
        this.stackOrder = this.stackOrder.filter((id) => id !== parentGoalId);
      }

      if (parent.parentGoalId) {
        this.updateParentProgress(parent.parentGoalId);
      }
    }
  }
}
