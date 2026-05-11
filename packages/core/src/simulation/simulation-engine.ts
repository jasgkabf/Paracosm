import type { SimulationConfig, SimulationResult, SimulationScore, SimulationPath, SimulationState, RiskAssessment, ResourceEstimate } from '@paracosm/shared';
import { generateId, ok, err, type Result, createLogger } from '@paracosm/shared';
import { PathExplorer } from './path-explorer.js';
import { Predictor } from './predictor.js';
import { Scorer } from './scorer.js';
import { MCTS } from './mcts.js';
import { SimulationCache } from './simulation-cache.js';
import { RiskAnalyzer } from './risk-analyzer.js';
import { ResourceEstimator } from './resource-estimator.js';
import { ParallelSimulator } from './parallel-simulator.js';
import { generateReport, type SimulationReport } from './simulation-report.js';
import type { SimulationEngineConfig, SimulationRun, PredictionResult } from './types.js';
import { DEFAULT_SIMULATION_ENGINE_CONFIG } from './types.js';

const logger = createLogger('SimulationEngine');

export class SimulationEngine {
  private config: SimulationEngineConfig;
  private runs: Map<string, SimulationRun> = new Map();
  private cache: SimulationCache;
  private predictor: Predictor;
  private scorer: Scorer;
  private riskAnalyzer: RiskAnalyzer;
  private resourceEstimator: ResourceEstimator;
  private parallelSimulator: ParallelSimulator;
  private listeners: Map<string, Array<(data: unknown) => void>> = new Map();

  constructor(config: Partial<SimulationEngineConfig> = {}) {
    this.config = { ...DEFAULT_SIMULATION_ENGINE_CONFIG, ...config };
    this.cache = new SimulationCache(100, this.config.cacheTtlMs);
    this.predictor = new Predictor(this.config.defaultConfig);
    this.scorer = new Scorer({ weights: this.config.defaultConfig.scoringWeights });
    this.riskAnalyzer = new RiskAnalyzer();
    this.resourceEstimator = new ResourceEstimator();
    this.parallelSimulator = new ParallelSimulator(this.config.defaultConfig, this.config.maxConcurrentSimulations);
  }

  on(event: string, listener: (data: unknown) => void): () => void {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
    return () => {
      const list = this.listeners.get(event);
      if (list) {
        const idx = list.indexOf(listener);
        if (idx !== -1) list.splice(idx, 1);
      }
    };
  }

  private emitEvent(event: string, data: unknown): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try { listener(data); } catch (error) { logger.error(`Event listener error: ${error}`); }
      }
    }
  }

  createRun(config?: Partial<SimulationConfig>): Result<SimulationRun> {
    const runConfig: SimulationConfig = { ...this.config.defaultConfig, ...config };
    const run: SimulationRun = {
      id: generateId(),
      config: runConfig,
      state: 'idle',
    };
    this.runs.set(run.id, run);
    this.emitEvent('run:created', run);
    return ok(run);
  }

  async run(
    initialState: Record<string, unknown>,
    transitionFn: (state: Record<string, unknown>) => Array<{ state: Record<string, unknown>; probability: number; transition: string; duration: number }>,
    config?: Partial<SimulationConfig>,
  ): Promise<Result<SimulationResult>> {
    const runResult = this.createRun(config);
    if (!runResult.ok) return err(runResult.err);
    const run = runResult.value;
    run.state = 'running';
    run.startedAt = new Date();
    this.emitEvent('run:started', run);
    try {
      const cacheKey = this.cache.generateKey(run.config, initialState);
      if (this.config.cacheResults) {
        const cached = this.cache.get(cacheKey);
        if (cached) {
          run.state = 'completed';
          run.result = cached;
          run.completedAt = new Date();
          this.emitEvent('run:completed', run);
          return ok(cached);
        }
      }
      const explorer = new PathExplorer(run.config);
      const explorationResult = explorer.explore(initialState, transitionFn);
      const scores = this.scorer.scoreAll(explorationResult.paths);
      const bestScore = scores.length > 0 ? scores.reduce((best, s) => s.overall > best.overall ? s : best, scores[0]) : null;
      const worstScore = scores.length > 0 ? scores.reduce((worst, s) => s.overall < worst.overall ? s : worst, scores[0]) : null;
      const avgScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s.overall, 0) / scores.length : 0;
      const confidence = this.computeConfidence(scores);
      const result: SimulationResult = {
        id: generateId(),
        paths: explorationResult.paths,
        scores,
        bestPathId: explorationResult.bestPathId,
        worstPathId: explorationResult.worstPathId,
        averageScore: avgScore,
        confidence,
        duration: explorationResult.duration,
        timestamp: new Date(),
        metadata: { runId: run.id },
      };
      if (this.config.cacheResults) {
        this.cache.set(cacheKey, result);
      }
      run.state = 'completed';
      run.result = result;
      run.completedAt = new Date();
      this.emitEvent('run:completed', run);
      return ok(result);
    } catch (error) {
      run.state = 'failed';
      run.error = error instanceof Error ? error.message : String(error);
      this.emitEvent('run:failed', run);
      return err(new Error(run.error));
    }
  }

  async runMCTS(
    initialState: Record<string, unknown>,
    actionGenerator: (state: Record<string, unknown>) => string[],
    transitionFn: (state: Record<string, unknown>, action: string) => { state: Record<string, unknown>; reward: number; terminal: boolean },
    evaluationFn: (state: Record<string, unknown>) => number,
  ): Promise<Result<SimulationResult>> {
    const mcts = new MCTS();
    const mctsResult = mcts.search(initialState, actionGenerator, transitionFn, evaluationFn);
    const result: SimulationResult = {
      id: generateId(),
      paths: mctsResult.bestPath ? [mctsResult.bestPath] : [],
      scores: [],
      bestPathId: mctsResult.bestPath?.id ?? '',
      worstPathId: '',
      averageScore: mctsResult.bestScore,
      confidence: mctsResult.bestScore,
      duration: mctsResult.duration,
      timestamp: new Date(),
      metadata: { iterations: mctsResult.totalIterations, nodesExplored: mctsResult.nodesExplored },
    };
    return ok(result);
  }

  predict(currentState: Record<string, unknown>, context?: Record<string, unknown>): PredictionResult {
    return this.predictor.predict(currentState, context);
  }

  analyzeRisks(pathData: Array<{ id: string; probability: number; metrics: Record<string, number>; outcome: string }>): RiskAssessment[] {
    return this.riskAnalyzer.analyze(pathData);
  }

  estimateResources(config: SimulationConfig, pathCount: number, stepsPerPath: number): ResourceEstimate {
    return this.resourceEstimator.estimate(config, pathCount, stepsPerPath);
  }

  generateReport(result: SimulationResult): SimulationReport {
    const riskAssessments = this.riskAnalyzer.analyze(
      result.paths.map((p) => ({
        id: p.id,
        probability: p.probability,
        metrics: p.steps.length > 0 ? p.steps[p.steps.length - 1].snapshot.metrics : {},
        outcome: p.outcome,
      })),
    );
    const resourceEstimate = this.resourceEstimator.estimate(
      this.config.defaultConfig,
      result.paths.length,
      this.config.defaultConfig.maxStepsPerPath,
    );
    return generateReport(result, result.scores, riskAssessments[0], resourceEstimate);
  }

  getRun(runId: string): SimulationRun | undefined {
    return this.runs.get(runId);
  }

  getAllRuns(): SimulationRun[] {
    return Array.from(this.runs.values());
  }

  getActiveRuns(): SimulationRun[] {
    return Array.from(this.runs.values()).filter((r) => r.state === 'running');
  }

  private computeConfidence(scores: SimulationScore[]): number {
    if (scores.length === 0) return 0;
    const avgScore = scores.reduce((sum, s) => sum + s.overall, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s.overall - avgScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    const consistencyFactor = 1 / (1 + stdDev);
    return avgScore * consistencyFactor;
  }

  clear(): void {
    this.runs.clear();
    this.cache.clear();
    this.parallelSimulator.clear();
    this.emitEvent('engine:cleared', null);
  }
}
