import type { SimulationConfig, SimulationPath, SimulationResult, SimulationScore } from '@paracosm/shared';
import { generateId, ok, err, type Result, createLogger } from '@paracosm/shared';
import { PathExplorer } from './path-explorer.js';
import { Scorer } from './scorer.js';
import { SimulationCache } from './simulation-cache.js';
import { RiskAnalyzer } from './risk-analyzer.js';
import { ResourceEstimator } from './resource-estimator.js';

const logger = createLogger('ParallelSimulator');

export interface SimulationTask {
  id: string;
  config: SimulationConfig;
  initialState: Record<string, unknown>;
  transitionFn: (state: Record<string, unknown>) => Array<{ state: Record<string, unknown>; probability: number; transition: string; duration: number }>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: ExplorationTaskResult;
  error?: string;
}

export interface ExplorationTaskResult {
  paths: SimulationPath[];
  scores: SimulationScore[];
  bestPathId: string;
  worstPathId: string;
  duration: number;
}

export class ParallelSimulator {
  private config: SimulationConfig;
  private cache: SimulationCache;
  private riskAnalyzer: RiskAnalyzer;
  private resourceEstimator: ResourceEstimator;
  private tasks: Map<string, SimulationTask> = new Map();
  private maxConcurrent: number;

  constructor(config: SimulationConfig, maxConcurrent: number = 4) {
    this.config = config;
    this.maxConcurrent = maxConcurrent;
    this.cache = new SimulationCache();
    this.riskAnalyzer = new RiskAnalyzer();
    this.resourceEstimator = new ResourceEstimator();
  }

  submitTask(initialState: Record<string, unknown>, transitionFn: SimulationTask['transitionFn'], config?: SimulationConfig): string {
    const id = generateId();
    const taskConfig = config ?? this.config;
    const task: SimulationTask = {
      id,
      config: taskConfig,
      initialState,
      transitionFn,
      status: 'pending',
    };
    this.tasks.set(id, task);
    return id;
  }

  async runTask(taskId: string): Promise<Result<ExplorationTaskResult>> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return err(new Error(`Task ${taskId} not found`));
    }
    task.status = 'running';
    try {
      const cacheKey = this.cache.generateKey(task.config, task.initialState);
      const cachedResult = this.cache.get(cacheKey);
      if (cachedResult) {
        const result: ExplorationTaskResult = {
          paths: cachedResult.paths,
          scores: cachedResult.scores,
          bestPathId: cachedResult.bestPathId,
          worstPathId: cachedResult.worstPathId,
          duration: 0,
        };
        task.result = result;
        task.status = 'completed';
        return ok(result);
      }
      const explorer = new PathExplorer(task.config);
      const explorationResult = explorer.explore(task.initialState, task.transitionFn);
      const scorer = new Scorer({ weights: task.config.scoringWeights });
      const scores = scorer.scoreAll(explorationResult.paths);
      const result: ExplorationTaskResult = {
        paths: explorationResult.paths,
        scores,
        bestPathId: explorationResult.bestPathId,
        worstPathId: explorationResult.worstPathId,
        duration: explorationResult.duration,
      };
      task.result = result;
      task.status = 'completed';
      return ok(result);
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      return err(new Error(task.error));
    }
  }

  async runAllPending(): Promise<Result<ExplorationTaskResult>[]> {
    const pendingTasks = Array.from(this.tasks.values()).filter((t) => t.status === 'pending');
    const results: Result<ExplorationTaskResult>[] = [];
    const batches: SimulationTask[][] = [];
    for (let i = 0; i < pendingTasks.length; i += this.maxConcurrent) {
      batches.push(pendingTasks.slice(i, i + this.maxConcurrent));
    }
    for (const batch of batches) {
      const batchResults = await Promise.all(batch.map((task) => this.runTask(task.id)));
      results.push(...batchResults);
    }
    return results;
  }

  getTask(taskId: string): SimulationTask | undefined {
    return this.tasks.get(taskId);
  }

  getTaskStatus(taskId: string): SimulationTask['status'] | null {
    const task = this.tasks.get(taskId);
    return task?.status ?? null;
  }

  getAllTasks(): SimulationTask[] {
    return Array.from(this.tasks.values());
  }

  getCompletedTasks(): SimulationTask[] {
    return Array.from(this.tasks.values()).filter((t) => t.status === 'completed');
  }

  clear(): void {
    this.tasks.clear();
    this.cache.clear();
  }
}
