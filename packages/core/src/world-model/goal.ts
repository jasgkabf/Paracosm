import type { Goal, GoalPriority, GoalState } from '@paracosm/shared';
import { generateId } from '@paracosm/shared';

export function createGoal(data: {
  name: string;
  description: string;
  priority?: GoalPriority;
  state?: GoalState;
  constraints?: string[];
  subGoals?: string[];
  progress?: number;
  deadline?: Date;
  metadata?: Record<string, unknown>;
  id?: string;
}): Goal {
  const now = new Date();
  return {
    id: data.id ?? generateId(),
    name: data.name,
    description: data.description,
    priority: data.priority ?? 'medium',
    state: data.state ?? 'pending',
    constraints: data.constraints ?? [],
    subGoals: data.subGoals ?? [],
    progress: data.progress ?? 0,
    deadline: data.deadline,
    metadata: data.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
}

export function computeGoalProgress(goal: Goal, subGoals: Map<string, Goal>): number {
  if (goal.subGoals.length === 0) return goal.progress;
  let totalProgress = 0;
  let count = 0;
  for (const subGoalId of goal.subGoals) {
    const subGoal = subGoals.get(subGoalId);
    if (subGoal) {
      totalProgress += computeGoalProgress(subGoal, subGoals);
      count++;
    }
  }
  if (count === 0) return goal.progress;
  return (totalProgress / count) * 0.7 + goal.progress * 0.3;
}

export function isGoalOverdue(goal: Goal): boolean {
  if (!goal.deadline) return false;
  return goal.deadline.getTime() < Date.now() && goal.state !== 'completed';
}

export function getGoalUrgency(goal: Goal): number {
  if (goal.state === 'completed') return 0;
  let urgency = 0;
  const priorityWeights: Record<GoalPriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  urgency += priorityWeights[goal.priority] * 25;
  if (goal.deadline) {
    const timeRemaining = goal.deadline.getTime() - Date.now();
    if (timeRemaining < 0) urgency += 50;
    else if (timeRemaining < 3600000) urgency += 30;
    else if (timeRemaining < 86400000) urgency += 15;
  }
  urgency += (1 - goal.progress) * 20;
  return Math.min(urgency, 100);
}

export function validateGoal(goal: Partial<Goal>): string[] {
  const errors: string[] = [];
  if (!goal.name || goal.name.trim().length === 0) {
    errors.push('Goal name is required');
  }
  if (goal.progress !== undefined && (goal.progress < 0 || goal.progress > 1)) {
    errors.push('Goal progress must be between 0 and 1');
  }
  if (goal.deadline && goal.deadline.getTime() < Date.now() && goal.state !== 'failed') {
    errors.push('Goal deadline is in the past');
  }
  return errors;
}
