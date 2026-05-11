import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { SimulationError } from "@paracosm/shared";
import type { SimulationResult, SimulationScore, SimulationViolation, SimulationSnapshot, EntityId, ConstraintId } from "@paracosm/shared";
import { SimulationStatus } from "@paracosm/shared";
import type { AggregatedResult, PathNode } from "./types.js";
import { Snapshot } from "./snapshot.js";
import { SimulationPath } from "./path.js";
import { Predictor } from "./predictor.js";
import { RiskAnalyzer } from "./risk-analyzer.js";
import { ResourceEstimator } from "./resource-estimator.js";

export interface SimulationTask {
  id: string;
  action: PathNode;
  snapshot: Snapshot;
  status: SimulationStatus;
  result: SimulationResult | null;
  error: string | null;
  startedAt: number | null;
  completedAt: number | null;
}

export class ParallelSimulator {
  private maxConcurrency: number;
  private tasks: Map<string, SimulationTask>;
  private queue: string[];
  private running: Set<string>;
  private cancelled: Set<string>;
  private predictor: Predictor;
  private riskAnalyzer: RiskAnalyzer;
  private resourceEstimator: ResourceEstimator;

  constructor(maxConcurrency: number = 4) {
    this.maxConcurrency = maxConcurrency;
    this.tasks = new Map();
    this.queue = [];
    this.running = new Set();
    this.cancelled = new Set();
    this.predictor = new Predictor();
    this.riskAnalyzer = new RiskAnalyzer();
    this.resourceEstimator = new ResourceEstimator();
  }

  async simulateBatch(
    tasks: Array<{ action: PathNode; snapshot: Snapshot }>,
    concurrency?: number
  ): Promise<SimulationResult[]> {
    const maxConcurrent = concurrency ?? this.maxConcurrency;
    const simulationTasks: SimulationTask[] = [];

    for (const task of tasks) {
      const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const simTask: SimulationTask = {
        id,
        action: task.action,
        snapshot: task.snapshot,
        status: SimulationStatus.Queued,
        result: null,
        error: null,
        startedAt: null,
        completedAt: null,
      };
      simulationTasks.push(simTask);
      this.tasks.set(id, simTask);
      this.queue.push(id);
    }

    const results: SimulationResult[] = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < Math.min(maxConcurrent, simulationTasks.length); i++) {
      executing.push(this.executeNext());
    }

    await Promise.all(executing);

    for (const task of simulationTasks) {
      if (task.result) {
        results.push(task.result);
      }
    }

    return results;
  }

  workerPool(size: number): WorkerPool {
    return new WorkerPool(size, this);
  }

  createTaskQueue(tasks: Array<{ action: PathNode; snapshot: Snapshot }>): AsyncQueue {
    return new AsyncQueue(tasks, this);
  }

  resultAggregator(results: SimulationResult[]): AggregatedResult {
    if (results.length === 0) {
      return {
        results: [],
        averageScore: 0,
        bestScore: 0,
        worstScore: 0,
        scoreVariance: 0,
        completedCount: 0,
        failedCount: 0,
        cancelledCount: 0,
        totalExecutionTimeMs: 0,
      };
    }

    const scores = results.map((r) => r.score.overall);
    const averageScore = scores.reduce((s, v) => s + v, 0) / scores.length;
    const bestScore = Math.max(...scores);
    const worstScore = Math.min(...scores);
    const scoreVariance = scores.reduce((s, v) => s + Math.pow(v - averageScore, 2), 0) / scores.length;

    const completedCount = results.filter((r) => r.score.overall > 0).length;
    const failedCount = results.filter((r) => r.violations.some((v) => v.severity === "critical")).length;
    const totalExecutionTimeMs = results.reduce((s, r) => s + r.executionTime, 0);

    return {
      results,
      averageScore,
      bestScore,
      worstScore,
      scoreVariance,
      completedCount,
      failedCount,
      cancelledCount: this.cancelled.size,
      totalExecutionTimeMs,
    };
  }

  cancel(taskId: string): void {
    this.cancelled.add(taskId);
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = SimulationStatus.Cancelled;
    }
  }

  getTask(taskId: string): SimulationTask | undefined {
    return this.tasks.get(taskId);
  }

  getTaskCount(): number {
    return this.tasks.size;
  }

  getRunningCount(): number {
    return this.running.size;
  }

  getQueuedCount(): number {
    return this.queue.length;
  }

  clear(): void {
    this.tasks.clear();
    this.queue = [];
    this.running.clear();
    this.cancelled.clear();
  }

  private async executeNext(): Promise<void> {
    while (this.queue.length > 0) {
      const taskId = this.queue.shift();
      if (!taskId) break;

      if (this.cancelled.has(taskId)) {
        continue;
      }

      const task = this.tasks.get(taskId);
      if (!task) continue;

      this.running.add(taskId);
      task.status = SimulationStatus.Running;
      task.startedAt = Date.now();

      try {
        const result = await this.executeTask(task);
        task.result = result;
        task.status = SimulationStatus.Completed;
        task.completedAt = Date.now();
      } catch (error) {
        task.error = error instanceof Error ? error.message : String(error);
        task.status = SimulationStatus.Failed;
        task.completedAt = Date.now();
      } finally {
        this.running.delete(taskId);
      }
    }
  }

  private async executeTask(task: SimulationTask): Promise<SimulationResult> {
    const startTime = Date.now();

    const prediction = this.predictor.predictOutcome(task.action, task.snapshot);
    const riskAssessment = this.riskAnalyzer.analyzeRisk(task.action, task.snapshot);

    const overallRisk = riskAssessment.ok ? riskAssessment.value.overallRisk : 0;
    const confidence = prediction.ok ? prediction.value.confidence : 0.5;
    const probability = prediction.ok ? prediction.value.probability : 0.5;

    const score: SimulationScore = {
      overall: probability * confidence * (1 - overallRisk),
      feasibility: probability,
      efficiency: 1.0 / (1.0 + task.action.cost),
      risk: 1.0 - overallRisk,
      goalAlignment: probability * 0.8,
      constraintSatisfaction: 1.0 - overallRisk * 0.8,
      resourceUtilization: 1.0 / (1.0 + task.action.duration / 1000),
      breakdown: {
        predictionConfidence: confidence,
        riskScore: overallRisk,
        probability,
      },
    };

    const violations: SimulationViolation[] = [];
    if (overallRisk > 0.7) {
      violations.push({
        constraintId: "risk_threshold" as unknown as ConstraintId,
        stepNumber: 0,
        severity: "critical",
        description: `Risk score ${(overallRisk * 100).toFixed(1)}% exceeds threshold`,
        remediation: "Consider alternative action with lower risk",
      });
    }

    if (task.action.cost > 2.0) {
      violations.push({
        constraintId: "cost_limit" as unknown as ConstraintId,
        stepNumber: 0,
        severity: "warning",
        description: `Action cost ${task.action.cost.toFixed(2)} is high`,
        remediation: "Optimize action parameters to reduce cost",
      });
    }

    const entityStates = new Map<EntityId, Record<string, unknown>>();
    entityStates.set(task.action.entityId, {
      lastAction: task.action.action,
      risk: overallRisk,
      cost: task.action.cost,
    });

    const finalState: SimulationSnapshot = {
      id: `snap_${Date.now()}`,
      pathId: task.id,
      stepNumber: 1,
      state: { action: task.action.action, risk: overallRisk },
      entityStates,
      activeConstraints: [],
      activeGoals: [],
      timestamp: new Date().toISOString(),
    };

    const insights: string[] = [];
    if (prediction.ok) {
      insights.push(`Predicted outcome: ${prediction.value.outcome}`);
      if (prediction.value.sideEffects.length > 0) {
        insights.push(`${prediction.value.sideEffects.length} potential side effects identified`);
      }
    }

    const recommendations: string[] = [];
    if (overallRisk > 0.5) {
      recommendations.push("High risk detected; consider mitigation strategies");
    }
    if (confidence < 0.5) {
      recommendations.push("Low prediction confidence; gather more data before proceeding");
    }

    return {
      pathId: task.id,
      score,
      finalState,
      violations,
      insights,
      recommendations,
      executionTime: Date.now() - startTime,
    };
  }
}

export class WorkerPool {
  private size: number;
  private simulator: ParallelSimulator;
  private active: number;

  constructor(size: number, simulator: ParallelSimulator) {
    this.size = size;
    this.simulator = simulator;
    this.active = 0;
  }

  getSize(): number {
    return this.size;
  }

  getActiveCount(): number {
    return this.active;
  }

  getAvailableCount(): number {
    return Math.max(0, this.size - this.active);
  }

  async execute(action: PathNode, snapshot: Snapshot): Promise<SimulationResult> {
    if (this.active >= this.size) {
      throw new SimulationError("Worker pool is at capacity", {
        size: this.size,
        active: this.active,
      });
    }

    this.active++;
    try {
      const results = await this.simulator.simulateBatch([{ action, snapshot }], 1);
      if (results.length === 0) {
        throw new SimulationError("No result returned from simulation");
      }
      return results[0];
    } finally {
      this.active--;
    }
  }

  resize(newSize: number): void {
    this.size = Math.max(1, newSize);
  }
}

export class AsyncQueue {
  private items: Array<{ action: PathNode; snapshot: Snapshot }>;
  private simulator: ParallelSimulator;
  private processedCount: number;

  constructor(
    items: Array<{ action: PathNode; snapshot: Snapshot }>,
    simulator: ParallelSimulator
  ) {
    this.items = [...items];
    this.simulator = simulator;
    this.processedCount = 0;
  }

  getLength(): number {
    return this.items.length;
  }

  getProcessedCount(): number {
    return this.processedCount;
  }

  enqueue(item: { action: PathNode; snapshot: Snapshot }): void {
    this.items.push(item);
  }

  dequeue(): { action: PathNode; snapshot: Snapshot } | undefined {
    return this.items.shift();
  }

  async processAll(concurrency: number = 4): Promise<SimulationResult[]> {
    const results = await this.simulator.simulateBatch(this.items, concurrency);
    this.processedCount = this.items.length;
    this.items = [];
    return results;
  }

  async processBatch(batchSize: number, concurrency: number = 4): Promise<SimulationResult[]> {
    const batch = this.items.splice(0, batchSize);
    const results = await this.simulator.simulateBatch(batch, concurrency);
    this.processedCount += batch.length;
    return results;
  }

  clear(): void {
    this.items = [];
  }
}
