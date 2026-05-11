import type { Goal, GoalPriority, GoalState } from '@paracosm/shared';
import { generateId, ok, err, type Result } from '@paracosm/shared';
import type { GoalDecomposition } from './types.js';

export class GoalStack {
  private goals: Map<string, Goal> = new Map();
  private activeGoals: Set<string> = new Set();
  private completedGoals: Set<string> = new Set();
  private failedGoals: Set<string> = new Set();
  private goalOrder: string[] = [];
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

  private priorityValue(priority: GoalPriority): number {
    const map: Record<GoalPriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    return map[priority];
  }

  pushGoal(goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Result<Goal> {
    const id = goal.id ?? generateId();
    if (this.goals.has(id)) {
      return err(new Error(`Goal with id ${id} already exists`));
    }
    const now = new Date();
    const newGoal: Goal = {
      ...goal,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.goals.set(id, newGoal);
    if (newGoal.state === 'active') {
      this.activeGoals.add(id);
    } else if (newGoal.state === 'completed') {
      this.completedGoals.add(id);
    } else if (newGoal.state === 'failed') {
      this.failedGoals.add(id);
    }
    this.insertGoalInOrder(id, newGoal.priority);
    this.emit('goal:pushed', newGoal);
    return ok(newGoal);
  }

  popGoal(): Goal | undefined {
    if (this.goalOrder.length === 0) return undefined;
    const id = this.goalOrder.shift()!;
    const goal = this.goals.get(id);
    if (goal) {
      this.updateGoalState(id, 'completed');
    }
    return goal;
  }

  peekGoal(): Goal | undefined {
    if (this.goalOrder.length === 0) return undefined;
    return this.goals.get(this.goalOrder[0]);
  }

  updateGoalState(id: string, state: GoalState): Result<Goal> {
    const goal = this.goals.get(id);
    if (!goal) {
      return err(new Error(`Goal with id ${id} not found`));
    }
    this.activeGoals.delete(id);
    this.completedGoals.delete(id);
    this.failedGoals.delete(id);
    if (state === 'active') this.activeGoals.add(id);
    else if (state === 'completed') this.completedGoals.add(id);
    else if (state === 'failed') this.failedGoals.add(id);
    const updated: Goal = { ...goal, state, updatedAt: new Date() };
    this.goals.set(id, updated);
    if (state === 'completed' || state === 'failed') {
      const idx = this.goalOrder.indexOf(id);
      if (idx !== -1) this.goalOrder.splice(idx, 1);
    }
    this.emit('goal:state_changed', { before: goal, after: updated });
    return ok(updated);
  }

  decompose(goalId: string): Result<GoalDecomposition> {
    const goal = this.goals.get(goalId);
    if (!goal) {
      return err(new Error(`Goal with id ${goalId} not found`));
    }
    const subGoals: Goal[] = [];
    const dependencies: GoalDecomposition['dependencies'] = [];
    let estimatedEffort = 0;
    for (const subGoalId of goal.subGoals) {
      const subGoal = this.goals.get(subGoalId);
      if (subGoal) {
        subGoals.push(subGoal);
        dependencies.push({ from: goalId, to: subGoalId, type: 'requires' });
        estimatedEffort += this.estimateEffort(subGoal);
      }
    }
    if (subGoals.length === 0 && goal.description.length > 50) {
      const parts = goal.description.split(/[.;]\s*/).filter((s) => s.trim().length > 0);
      for (let i = 0; i < parts.length; i++) {
        const subGoal: Goal = {
          id: generateId(),
          name: `${goal.name} - Part ${i + 1}`,
          description: parts[i].trim(),
          priority: goal.priority,
          state: 'pending',
          constraints: [],
          subGoals: [],
          progress: 0,
          deadline: goal.deadline,
          metadata: { parentGoalId: goalId },
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        subGoals.push(subGoal);
        dependencies.push({ from: goalId, to: subGoal.id, type: 'requires' });
        if (i > 0) {
          dependencies.push({ from: subGoals[i - 1].id, to: subGoal.id, type: 'depends_on' });
        }
        estimatedEffort += this.estimateEffort(subGoal);
      }
    }
    return ok({
      parentGoal: goal,
      subGoals,
      dependencies,
      estimatedEffort,
    });
  }

  prioritize(): Goal[] {
    const prioritized = this.goalOrder
      .map((id) => this.goals.get(id))
      .filter((g): g is Goal => g !== undefined)
      .sort((a, b) => {
        const priorityDiff = this.priorityValue(b.priority) - this.priorityValue(a.priority);
        if (priorityDiff !== 0) return priorityDiff;
        if (a.deadline && b.deadline) {
          return a.deadline.getTime() - b.deadline.getTime();
        }
        if (a.deadline) return -1;
        if (b.deadline) return 1;
        return b.progress - a.progress;
      });
    this.goalOrder = prioritized.map((g) => g.id);
    return prioritized;
  }

  checkDependency(goalId: string): { met: boolean; pending: string[] } {
    const goal = this.goals.get(goalId);
    if (!goal) return { met: false, pending: [goalId] };
    const pending: string[] = [];
    for (const constraintId of goal.constraints) {
      const constraintGoal = this.goals.get(constraintId);
      if (constraintGoal && constraintGoal.state !== 'completed') {
        pending.push(constraintId);
      }
    }
    for (const subGoalId of goal.subGoals) {
      const subGoal = this.goals.get(subGoalId);
      if (subGoal && subGoal.state !== 'completed') {
        pending.push(subGoalId);
      }
    }
    return { met: pending.length === 0, pending };
  }

  getActiveGoals(): Goal[] {
    return Array.from(this.activeGoals)
      .map((id) => this.goals.get(id))
      .filter((g): g is Goal => g !== undefined);
  }

  getCompletedGoals(): Goal[] {
    return Array.from(this.completedGoals)
      .map((id) => this.goals.get(id))
      .filter((g): g is Goal => g !== undefined);
  }

  getFailedGoals(): Goal[] {
    return Array.from(this.failedGoals)
      .map((id) => this.goals.get(id))
      .filter((g): g is Goal => g !== undefined);
  }

  getGoal(id: string): Goal | undefined {
    return this.goals.get(id);
  }

  getGoalCount(): number {
    return this.goals.size;
  }

  getActiveCount(): number {
    return this.activeGoals.size;
  }

  getCompletedCount(): number {
    return this.completedGoals.size;
  }

  getFailedCount(): number {
    return this.failedGoals.size;
  }

  getAllGoals(): Goal[] {
    return Array.from(this.goals.values());
  }

  clear(): void {
    this.goals.clear();
    this.activeGoals.clear();
    this.completedGoals.clear();
    this.failedGoals.clear();
    this.goalOrder = [];
    this.emit('goals:cleared', null);
  }

  private insertGoalInOrder(id: string, priority: GoalPriority): void {
    const priorityVal = this.priorityValue(priority);
    let insertIdx = this.goalOrder.length;
    for (let i = 0; i < this.goalOrder.length; i++) {
      const existingGoal = this.goals.get(this.goalOrder[i]);
      if (existingGoal && this.priorityValue(existingGoal.priority) < priorityVal) {
        insertIdx = i;
        break;
      }
    }
    this.goalOrder.splice(insertIdx, 0, id);
  }

  private estimateEffort(goal: Goal): number {
    let effort = 1;
    if (goal.priority === 'critical') effort += 3;
    else if (goal.priority === 'high') effort += 2;
    else if (goal.priority === 'medium') effort += 1;
    effort += goal.subGoals.length;
    effort += goal.constraints.length * 0.5;
    if (goal.deadline) {
      const timeRemaining = goal.deadline.getTime() - Date.now();
      if (timeRemaining < 3600000) effort += 2;
    }
    return effort;
  }
}
