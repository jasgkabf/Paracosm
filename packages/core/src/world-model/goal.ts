import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { GoalPriority, GoalState } from "@paracosm/shared";
import { generateId } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import type { GoalRecord, GoalDependency } from "./types.js";

interface GoalCreateParams {
  name: string;
  description?: string;
  priority?: GoalPriority;
  state?: GoalState;
  parentGoalId?: string | null;
  successCriteria?: string;
  progress?: number;
  deadline?: string | null;
  assigneeId?: string | null;
}

const VALID_GOAL_PRIORITIES = new Set<number>(Object.values(GoalPriority).filter((v) => typeof v === "number"));
const VALID_GOAL_STATES = new Set<string>(Object.values(GoalState));

export class Goal {
  static create(params: GoalCreateParams): Result<GoalRecord, ValidationError> {
    const validation = Goal.validateParams(params);
    if (!validation.ok) {
      return validation;
    }

    const now = new Date().toISOString();
    const id = `goal_${generateId()}`;

    const record: GoalRecord = {
      id,
      name: params.name,
      description: params.description ?? "",
      priority: params.priority ?? GoalPriority.Medium,
      state: params.state ?? GoalState.Pending,
      parentGoalId: params.parentGoalId ?? null,
      subGoalIds: new Set(),
      constraintIds: new Set(),
      successCriteria: params.successCriteria ?? "",
      progress: params.progress ?? 0,
      deadline: params.deadline ?? null,
      assigneeId: params.assigneeId ?? null,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    return ok(record);
  }

  static validateParams(params: Partial<GoalCreateParams>): Result<true, ValidationError> {
    if (!params.name || typeof params.name !== "string" || params.name.trim().length === 0) {
      return err(new ValidationError("Goal name is required and must be a non-empty string", {
        field: "name",
      }));
    }

    if (params.name.length > 256) {
      return err(new ValidationError("Goal name must not exceed 256 characters", {
        field: "name",
        maxLength: 256,
        actualLength: params.name.length,
      }));
    }

    if (params.priority !== undefined && !VALID_GOAL_PRIORITIES.has(params.priority)) {
      return err(new ValidationError("Goal priority must be a valid GoalPriority", {
        field: "priority",
        validValues: Object.entries(GoalPriority).filter(([, v]) => typeof v === "number").map(([k]) => k),
      }));
    }

    if (params.state !== undefined && !VALID_GOAL_STATES.has(params.state)) {
      return err(new ValidationError("Goal state must be a valid GoalState", {
        field: "state",
        validValues: Object.values(GoalState),
      }));
    }

    if (params.progress !== undefined) {
      if (typeof params.progress !== "number" || !Number.isFinite(params.progress) || params.progress < 0 || params.progress > 100) {
        return err(new ValidationError("Goal progress must be a number between 0 and 100", {
          field: "progress",
          value: params.progress,
        }));
      }
    }

    if (params.deadline !== undefined && params.deadline !== null) {
      const parsed = Date.parse(params.deadline);
      if (isNaN(parsed)) {
        return err(new ValidationError("Goal deadline must be a valid ISO 8601 string or null", {
          field: "deadline",
          value: params.deadline,
        }));
      }
    }

    if (params.parentGoalId !== undefined && params.parentGoalId !== null) {
      if (typeof params.parentGoalId !== "string" || params.parentGoalId.trim().length === 0) {
        return err(new ValidationError("Goal parentGoalId must be a non-empty string or null", {
          field: "parentGoalId",
        }));
      }
    }

    return ok(true);
  }

  static validate(record: GoalRecord): Result<true, ValidationError> {
    if (!record.id || typeof record.id !== "string") {
      return err(new ValidationError("Goal id is required and must be a string", {
        field: "id",
      }));
    }

    if (!record.name || typeof record.name !== "string") {
      return err(new ValidationError("Goal name is required and must be a string", {
        field: "name",
        goalId: record.id,
      }));
    }

    if (!VALID_GOAL_PRIORITIES.has(record.priority)) {
      return err(new ValidationError("Goal priority must be a valid GoalPriority", {
        field: "priority",
        goalId: record.id,
      }));
    }

    if (!VALID_GOAL_STATES.has(record.state)) {
      return err(new ValidationError("Goal state must be a valid GoalState", {
        field: "state",
        goalId: record.id,
      }));
    }

    if (typeof record.progress !== "number" || record.progress < 0 || record.progress > 100) {
      return err(new ValidationError("Goal progress must be between 0 and 100", {
        field: "progress",
        goalId: record.id,
      }));
    }

    if (!(record.subGoalIds instanceof Set)) {
      return err(new ValidationError("Goal subGoalIds must be a Set", {
        field: "subGoalIds",
        goalId: record.id,
      }));
    }

    if (!(record.constraintIds instanceof Set)) {
      return err(new ValidationError("Goal constraintIds must be a Set", {
        field: "constraintIds",
        goalId: record.id,
      }));
    }

    return ok(true);
  }

  static decompose(
    goal: GoalRecord,
    subGoalNames: string[]
  ): Result<GoalRecord[], ValidationError> {
    if (subGoalNames.length === 0) {
      return err(new ValidationError("Must provide at least one sub-goal name", {
        goalId: goal.id,
      }));
    }

    if (subGoalNames.length > 20) {
      return err(new ValidationError("Cannot decompose into more than 20 sub-goals", {
        goalId: goal.id,
        count: subGoalNames.length,
      }));
    }

    const now = new Date().toISOString();
    const subGoals: GoalRecord[] = [];

    const updatedParent = Goal.clone(goal);
    updatedParent.updatedAt = now;
    updatedParent.version += 1;

    for (const name of subGoalNames) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return err(new ValidationError("Each sub-goal name must be a non-empty string", {
          goalId: goal.id,
          invalidName: name,
        }));
      }

      const subGoalId = `goal_${generateId()}`;
      const subGoal: GoalRecord = {
        id: subGoalId,
        name: name.trim(),
        description: `Sub-goal of "${goal.name}"`,
        priority: goal.priority,
        state: GoalState.Pending,
        parentGoalId: goal.id,
        subGoalIds: new Set(),
        constraintIds: new Set(),
        successCriteria: "",
        progress: 0,
        deadline: goal.deadline,
        assigneeId: goal.assigneeId,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };

      subGoals.push(subGoal);
      updatedParent.subGoalIds.add(subGoalId);
    }

    return ok([updatedParent, ...subGoals]);
  }

  static estimateComplexity(goal: GoalRecord, allGoals: Map<string, GoalRecord>): number {
    let complexity = 1;

    const subGoalCount = goal.subGoalIds.size;
    complexity += subGoalCount * 0.5;

    const constraintCount = goal.constraintIds.size;
    complexity += constraintCount * 0.3;

    if (goal.deadline) {
      const deadlineTime = new Date(goal.deadline).getTime();
      const now = Date.now();
      const timeRemaining = deadlineTime - now;
      if (timeRemaining < 0) {
        complexity += 2;
      } else if (timeRemaining < 86400000) {
        complexity += 1;
      }
    }

    if (goal.priority === GoalPriority.Critical) {
      complexity += 1;
    } else if (goal.priority === GoalPriority.High) {
      complexity += 0.5;
    }

    if (goal.successCriteria.length > 0) {
      complexity += 0.2;
    }

    const visited = new Set<string>();
    const queue: string[] = [goal.id];
    let depth = 0;

    while (queue.length > 0 && depth < 10) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const currentGoal = allGoals.get(currentId);
      if (!currentGoal) continue;

      for (const subId of currentGoal.subGoalIds) {
        if (!visited.has(subId)) {
          queue.push(subId);
        }
      }

      depth++;
    }

    complexity += (visited.size - 1) * 0.4;

    return Math.round(complexity * 10) / 10;
  }

  static checkDependencies(
    goal: GoalRecord,
    allGoals: Map<string, GoalRecord>
  ): GoalDependency {
    const dependsOn: string[] = [];
    let satisfied = true;

    if (goal.parentGoalId) {
      dependsOn.push(goal.parentGoalId);
      const parent = allGoals.get(goal.parentGoalId);
      if (!parent || parent.state !== GoalState.Completed) {
        satisfied = false;
      }
    }

    for (const constraintId of goal.constraintIds) {
      dependsOn.push(constraintId);
    }

    return {
      goalId: goal.id,
      dependsOn,
      satisfied,
    };
  }

  static serialize(record: GoalRecord): Record<string, unknown> {
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      priority: record.priority,
      state: record.state,
      parentGoalId: record.parentGoalId,
      subGoalIds: Array.from(record.subGoalIds),
      constraintIds: Array.from(record.constraintIds),
      successCriteria: record.successCriteria,
      progress: record.progress,
      deadline: record.deadline,
      assigneeId: record.assigneeId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    };
  }

  static deserialize(data: Record<string, unknown>): Result<GoalRecord, ValidationError> {
    if (!data || typeof data !== "object") {
      return err(new ValidationError("Goal data must be a non-null object"));
    }

    if (!data.id || typeof data.id !== "string") {
      return err(new ValidationError("Goal data must contain a string 'id' field"));
    }

    const subGoalIds = new Set<string>();
    if (Array.isArray(data.subGoalIds)) {
      for (const id of data.subGoalIds) {
        if (typeof id === "string") {
          subGoalIds.add(id);
        }
      }
    }

    const constraintIds = new Set<string>();
    if (Array.isArray(data.constraintIds)) {
      for (const id of data.constraintIds) {
        if (typeof id === "string") {
          constraintIds.add(id);
        }
      }
    }

    const record: GoalRecord = {
      id: data.id as string,
      name: (data.name as string) ?? "",
      description: (data.description as string) ?? "",
      priority: (data.priority as GoalPriority) ?? GoalPriority.Medium,
      state: (data.state as GoalState) ?? GoalState.Pending,
      parentGoalId: (data.parentGoalId as string | null) ?? null,
      subGoalIds,
      constraintIds,
      successCriteria: (data.successCriteria as string) ?? "",
      progress: (data.progress as number) ?? 0,
      deadline: (data.deadline as string | null) ?? null,
      assigneeId: (data.assigneeId as string | null) ?? null,
      createdAt: (data.createdAt as string) ?? new Date().toISOString(),
      updatedAt: (data.updatedAt as string) ?? new Date().toISOString(),
      version: (data.version as number) ?? 1,
    };

    const validation = Goal.validate(record);
    if (!validation.ok) {
      return validation;
    }

    return ok(record);
  }

  static clone(record: GoalRecord): GoalRecord {
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      priority: record.priority,
      state: record.state,
      parentGoalId: record.parentGoalId,
      subGoalIds: new Set(record.subGoalIds),
      constraintIds: new Set(record.constraintIds),
      successCriteria: record.successCriteria,
      progress: record.progress,
      deadline: record.deadline,
      assigneeId: record.assigneeId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    };
  }
}
