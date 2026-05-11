import type { CSEPhase, ProgressInfo } from "./types.js";

interface TaskProgress {
  taskId: string;
  phase: CSEPhase;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  startTime: string | null;
  endTime: string | null;
  estimatedCompletion: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
  progressHistory: Array<{ timestamp: string; value: number }>;
}

export class ProgressTracker {
  private tasks: Map<string, TaskProgress>;
  private maxHistoryPerTask: number;

  constructor(maxHistoryPerTask: number = 100) {
    this.tasks = new Map();
    this.maxHistoryPerTask = maxHistoryPerTask;
  }

  start(taskId: string, phase?: CSEPhase): void {
    const now = new Date().toISOString();
    const task: TaskProgress = {
      taskId,
      phase: phase ?? ("CONSTRUCT" as CSEPhase),
      status: "running",
      progress: 0,
      startTime: now,
      endTime: null,
      estimatedCompletion: null,
      error: null,
      metadata: {},
      progressHistory: [{ timestamp: now, value: 0 }],
    };
    this.tasks.set(taskId, task);
  }

  update(taskId: string, progress: number): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }
    if (task.status !== "running") {
      return;
    }

    const clampedProgress = Math.max(0, Math.min(1, progress));
    task.progress = clampedProgress;

    const now = new Date().toISOString();
    task.progressHistory.push({ timestamp: now, value: clampedProgress });
    if (task.progressHistory.length > this.maxHistoryPerTask) {
      task.progressHistory.shift();
    }

    if (task.startTime && task.progressHistory.length >= 2) {
      const startTime = new Date(task.startTime).getTime();
      const currentTime = Date.now();
      const elapsedMs = currentTime - startTime;

      if (clampedProgress > 0 && elapsedMs > 0) {
        const estimatedTotalMs = elapsedMs / clampedProgress;
        const remainingMs = estimatedTotalMs - elapsedMs;
        const estimatedEndTime = new Date(currentTime + remainingMs);
        task.estimatedCompletion = estimatedEndTime.toISOString();
      }
    }
  }

  complete(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }
    task.status = "completed";
    task.progress = 1;
    task.endTime = new Date().toISOString();
    task.estimatedCompletion = task.endTime;

    task.progressHistory.push({
      timestamp: task.endTime,
      value: 1,
    });
    if (task.progressHistory.length > this.maxHistoryPerTask) {
      task.progressHistory.shift();
    }
  }

  fail(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }
    task.status = "failed";
    task.endTime = new Date().toISOString();
    task.error = error;
    task.estimatedCompletion = null;

    task.progressHistory.push({
      timestamp: task.endTime,
      value: task.progress,
    });
    if (task.progressHistory.length > this.maxHistoryPerTask) {
      task.progressHistory.shift();
    }
  }

  estimate(taskId: string): number {
    const task = this.tasks.get(taskId);
    if (!task) {
      return 0;
    }
    if (task.status === "completed") {
      return 100;
    }
    if (task.status === "failed") {
      return Math.round(task.progress * 100);
    }
    if (task.status === "pending") {
      return 0;
    }

    if (task.progressHistory.length < 2 || !task.startTime) {
      return Math.round(task.progress * 100);
    }

    const recentHistory = task.progressHistory.slice(-5);
    if (recentHistory.length < 2) {
      return Math.round(task.progress * 100);
    }

    const firstEntry = recentHistory[0];
    const lastEntry = recentHistory[recentHistory.length - 1];
    const timeDelta = new Date(lastEntry.timestamp).getTime() - new Date(firstEntry.timestamp).getTime();
    const progressDelta = lastEntry.value - firstEntry.value;

    if (timeDelta <= 0 || progressDelta <= 0) {
      return Math.round(task.progress * 100);
    }

    const rate = progressDelta / timeDelta;
    const remaining = 1 - task.progress;
    if (rate <= 0) {
      return Math.round(task.progress * 100);
    }

    const estimatedRemainingMs = remaining / rate;
    const elapsedMs = Date.now() - new Date(task.startTime).getTime();
    const totalEstimatedMs = elapsedMs + estimatedRemainingMs;

    const estimatedCompletionPercent = Math.min(100, Math.round((elapsedMs / totalEstimatedMs) * 100));
    return estimatedCompletionPercent;
  }

  report(taskId: string): ProgressInfo {
    const task = this.tasks.get(taskId);
    if (!task) {
      return {
        taskId,
        phase: "CONSTRUCT" as CSEPhase,
        status: "pending",
        progress: 0,
        startTime: null,
        endTime: null,
        estimatedCompletion: null,
        error: null,
        metadata: {},
      };
    }

    return {
      taskId: task.taskId,
      phase: task.phase,
      status: task.status,
      progress: task.progress,
      startTime: task.startTime,
      endTime: task.endTime,
      estimatedCompletion: task.estimatedCompletion,
      error: task.error,
      metadata: task.metadata,
    };
  }

  getAllActive(): Map<string, ProgressInfo> {
    const result = new Map<string, ProgressInfo>();
    for (const [taskId, task] of this.tasks) {
      if (task.status === "running" || task.status === "pending") {
        result.set(taskId, {
          taskId: task.taskId,
          phase: task.phase,
          status: task.status,
          progress: task.progress,
          startTime: task.startTime,
          endTime: task.endTime,
          estimatedCompletion: task.estimatedCompletion,
          error: task.error,
          metadata: task.metadata,
        });
      }
    }
    return result;
  }

  remove(taskId: string): void {
    this.tasks.delete(taskId);
  }

  getCompleted(): Map<string, ProgressInfo> {
    const result = new Map<string, ProgressInfo>();
    for (const [taskId, task] of this.tasks) {
      if (task.status === "completed") {
        result.set(taskId, {
          taskId: task.taskId,
          phase: task.phase,
          status: task.status,
          progress: task.progress,
          startTime: task.startTime,
          endTime: task.endTime,
          estimatedCompletion: task.estimatedCompletion,
          error: task.error,
          metadata: task.metadata,
        });
      }
    }
    return result;
  }

  getFailed(): Map<string, ProgressInfo> {
    const result = new Map<string, ProgressInfo>();
    for (const [taskId, task] of this.tasks) {
      if (task.status === "failed") {
        result.set(taskId, {
          taskId: task.taskId,
          phase: task.phase,
          status: task.status,
          progress: task.progress,
          startTime: task.startTime,
          endTime: task.endTime,
          estimatedCompletion: task.estimatedCompletion,
          error: task.error,
          metadata: task.metadata,
        });
      }
    }
    return result;
  }

  clearCompleted(): void {
    for (const [taskId, task] of this.tasks) {
      if (task.status === "completed" || task.status === "failed") {
        this.tasks.delete(taskId);
      }
    }
  }
}
