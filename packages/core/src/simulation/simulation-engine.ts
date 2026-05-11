import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { SimulationError, ValidationError } from "@paracosm/shared";
import type { SimulationResult, SimulationScore, SimulationViolation, SimulationSnapshot, EntityId } from "@paracosm/shared";
import { SimulationStatus } from "@paracosm/shared";
import type {
  SimulationConfig,
  SimulationState,
  SimulationEvent,
  SimulationEventName,
  SimulationEventHandler,
  PathNode,
} from "./types.js";
import { DEFAULT_SIMULATION_CONFIG } from "./types.js";
import { Snapshot } from "./snapshot.js";
import { SimulationPath } from "./path.js";
import { PathExplorer } from "./path-explorer.js";
import { Predictor } from "./predictor.js";
import { Scorer } from "./scorer.js";
import { MonteCarloTS } from "./mcts.js";
import type { MCTSState } from "./mcts.js";
import { SimulationCache } from "./simulation-cache.js";
import { SimulationReport } from "./simulation-report.js";
import { RiskAnalyzer } from "./risk-analyzer.js";
import { ResourceEstimator } from "./resource-estimator.js";
import { ParallelSimulator } from "./parallel-simulator.js";

export interface SimulationOptions {
  maxSteps?: number;
  maxPaths?: number;
  strategy?: "explore" | "mcts" | "hybrid";
  useCache?: boolean;
  riskThreshold?: number;
}

const DEFAULT_SIMULATION_OPTIONS: SimulationOptions = {
  maxSteps: 100,
  maxPaths: 50,
  strategy: "explore",
  useCache: true,
  riskThreshold: 0.7,
};

export class SimulationEngine {
  private config: SimulationConfig;
  private state: SimulationState;
  private initialized: boolean;
  private eventHandlers: Map<SimulationEventName, Set<SimulationEventHandler>>;
  private pathExplorer: PathExplorer;
  private predictor: Predictor;
  private scorer: Scorer;
  private mcts: MonteCarloTS;
  private cache: SimulationCache;
  private reportGenerator: SimulationReport;
  private riskAnalyzer: RiskAnalyzer;
  private resourceEstimator: ResourceEstimator;
  private parallelSimulator: ParallelSimulator;
  private results: Map<string, SimulationResult>;
  private snapshots: Map<string, Snapshot>;
  private paths: Map<string, SimulationPath>;
  private activeSimulations: Map<string, { status: SimulationStatus; startedAt: number }>;

  constructor(config?: Partial<SimulationConfig>) {
    this.config = { ...DEFAULT_SIMULATION_CONFIG, ...config };
    this.state = {
      status: SimulationStatus.Queued,
      currentStep: 0,
      totalSteps: 0,
      activePaths: 0,
      completedPaths: 0,
      startTime: null,
      endTime: null,
      progress: 0,
      error: null,
    };
    this.initialized = false;
    this.eventHandlers = new Map();
    this.pathExplorer = new PathExplorer({
      maxDepth: this.config.maxSteps,
      maxPaths: this.config.maxPaths,
      branchFactor: this.config.branchFactor,
      pruningThreshold: this.config.pruningThreshold,
      explorationRate: this.config.explorationRate,
      timeLimitMs: this.config.timeLimitMs,
      seed: this.config.seed,
    });
    this.predictor = new Predictor();
    this.scorer = new Scorer();
    this.mcts = new MonteCarloTS({
      iterations: this.config.mctsIterations,
      explorationParam: this.config.mctsExplorationParam,
      maxDepth: this.config.maxSteps,
      timeLimitMs: this.config.timeLimitMs,
      seed: this.config.seed,
    });
    this.cache = new SimulationCache({
      maxSize: this.config.cacheMaxSize,
      ttlMs: this.config.cacheTtlMs,
    });
    this.reportGenerator = new SimulationReport();
    this.riskAnalyzer = new RiskAnalyzer(this.config.riskThreshold);
    this.resourceEstimator = new ResourceEstimator();
    this.parallelSimulator = new ParallelSimulator(this.config.parallelPaths);
    this.results = new Map();
    this.snapshots = new Map();
    this.paths = new Map();
    this.activeSimulations = new Map();
  }

  init(config?: Partial<SimulationConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.pathExplorer = new PathExplorer({
      maxDepth: this.config.maxSteps,
      maxPaths: this.config.maxPaths,
      branchFactor: this.config.branchFactor,
      pruningThreshold: this.config.pruningThreshold,
      explorationRate: this.config.explorationRate,
      timeLimitMs: this.config.timeLimitMs,
      seed: this.config.seed,
    });

    this.mcts = new MonteCarloTS({
      iterations: this.config.mctsIterations,
      explorationParam: this.config.mctsExplorationParam,
      maxDepth: this.config.maxSteps,
      timeLimitMs: this.config.timeLimitMs,
      seed: this.config.seed,
    });

    this.riskAnalyzer = new RiskAnalyzer(this.config.riskThreshold);
    this.parallelSimulator = new ParallelSimulator(this.config.parallelPaths);

    this.initialized = true;
    this.state.status = SimulationStatus.Queued;

    this.emit({
      type: "engine:initialized",
      timestamp: new Date().toISOString(),
      data: { config: this.config },
    });
  }

  shutdown(): void {
    this.cancelAll();

    this.results.clear();
    this.snapshots.clear();
    this.paths.clear();
    this.activeSimulations.clear();
    this.cache.clear();
    this.parallelSimulator.clear();

    this.initialized = false;
    this.state.status = SimulationStatus.Cancelled;

    this.emit({
      type: "engine:shutdown",
      timestamp: new Date().toISOString(),
      data: {},
    });
  }

  async simulate(action: string, options?: SimulationOptions): Promise<Result<SimulationResult, SimulationError>> {
    if (!this.initialized) {
      return err(new SimulationError("Engine is not initialized"));
    }

    const opts = { ...DEFAULT_SIMULATION_OPTIONS, ...options };
    const simulationId = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    this.activeSimulations.set(simulationId, {
      status: SimulationStatus.Running,
      startedAt: Date.now(),
    });

    this.state.status = SimulationStatus.Running;
    this.state.startTime = new Date().toISOString();
    this.state.currentStep = 0;
    this.state.error = null;

    this.emit({
      type: "simulation:started",
      timestamp: new Date().toISOString(),
      data: { simulationId, action },
    });

    try {
      const cacheKey = this.cache.generateKey({
        action,
        config: opts as Record<string, unknown>,
      });

      if (opts.useCache && this.config.cacheEnabled) {
        const cached = this.cache.retrieve(cacheKey);
        if (cached) {
          this.emit({
            type: "cache:hit",
            timestamp: new Date().toISOString(),
            data: { key: cacheKey },
          });
          return ok(cached);
        }

        this.emit({
          type: "cache:miss",
          timestamp: new Date().toISOString(),
          data: { key: cacheKey },
        });
      }

      const actionNode: PathNode = {
        id: `action_${Date.now()}`,
        action,
        parameters: { simulationId },
        entityId: "" as any,
        timestamp: new Date().toISOString(),
        stateDelta: {},
        cost: 0.5,
        risk: 0.2,
        duration: 500,
      };

      const prediction = this.predictor.predictOutcome(actionNode, this.createEmptySnapshot());

      const riskAssessment = this.riskAnalyzer.analyzeRisk(actionNode, this.createEmptySnapshot());
      const overallRisk = riskAssessment.ok ? riskAssessment.value.overallRisk : 0;

      if (overallRisk > (opts.riskThreshold ?? this.config.riskThreshold)) {
        this.emit({
          type: "risk:threshold-exceeded",
          timestamp: new Date().toISOString(),
          data: { risk: overallRisk, threshold: opts.riskThreshold ?? this.config.riskThreshold },
        });
      }

      const paths = this.explorePaths(actionNode, opts);

      let bestPath: SimulationPath | null = null;
      if (paths.length > 0) {
        const bestPaths = this.pathExplorer.selectBest(paths, 1);
        bestPath = bestPaths[0] ?? null;
      }

      const score = this.computeFinalScore(prediction, riskAssessment, bestPath);

      const violations = this.computeViolations(riskAssessment, actionNode);

      const insights = this.computeInsights(prediction, paths);

      const recommendations = this.computeRecommendations(riskAssessment, bestPath, paths);

      const entityStates = new Map<EntityId, Record<string, unknown>>();
      const finalState: SimulationSnapshot = {
        id: `snap_${Date.now()}`,
        pathId: simulationId,
        stepNumber: 1,
        state: { action, risk: overallRisk, strategy: opts.strategy },
        entityStates,
        activeConstraints: [],
        activeGoals: [],
        timestamp: new Date().toISOString(),
      };

      const result: SimulationResult = {
        pathId: simulationId,
        score,
        finalState,
        violations,
        insights,
        recommendations,
        executionTime: Date.now() - (this.activeSimulations.get(simulationId)?.startedAt ?? Date.now()),
      };

      this.results.set(simulationId, result);

      if (opts.useCache && this.config.cacheEnabled) {
        this.cache.store(cacheKey, result);
      }

      this.state.status = SimulationStatus.Completed;
      this.state.endTime = new Date().toISOString();
      this.state.completedPaths++;
      this.state.progress = 1;

      this.activeSimulations.set(simulationId, { status: SimulationStatus.Completed, startedAt: this.activeSimulations.get(simulationId)?.startedAt ?? Date.now() });

      this.emit({
        type: "simulation:completed",
        timestamp: new Date().toISOString(),
        data: { simulationId, score: score.overall },
      });

      return ok(result);
    } catch (error) {
      this.state.status = SimulationStatus.Failed;
      this.state.error = error instanceof Error ? error.message : String(error);
      this.state.endTime = new Date().toISOString();

      this.activeSimulations.set(simulationId, { status: SimulationStatus.Failed, startedAt: this.activeSimulations.get(simulationId)?.startedAt ?? Date.now() });

      this.emit({
        type: "simulation:failed",
        timestamp: new Date().toISOString(),
        data: { simulationId, error: this.state.error },
      });

      return err(new SimulationError(this.state.error ?? "Simulation failed", { simulationId }));
    }
  }

  async simulateParallel(actions: string[], options?: SimulationOptions): Promise<Result<SimulationResult[], SimulationError>> {
    if (!this.initialized) {
      return err(new SimulationError("Engine is not initialized"));
    }

    const results: SimulationResult[] = [];

    for (const action of actions) {
      const result = await this.simulate(action, options);
      if (result.ok) {
        results.push(result.value);
      }
    }

    return ok(results);
  }

  getResults(id: string): SimulationResult | null {
    return this.results.get(id) ?? null;
  }

  cancel(id: string): void {
    const active = this.activeSimulations.get(id);
    if (active && active.status === SimulationStatus.Running) {
      this.activeSimulations.set(id, { status: SimulationStatus.Cancelled, startedAt: active.startedAt });
      this.parallelSimulator.cancel(id);

      this.emit({
        type: "simulation:cancelled",
        timestamp: new Date().toISOString(),
        data: { simulationId: id },
      });
    }
  }

  on(event: SimulationEventName, handler: SimulationEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: SimulationEventName, handler: SimulationEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  getState(): SimulationState {
    return { ...this.state };
  }

  getConfig(): SimulationConfig {
    return { ...this.config };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getCache(): SimulationCache {
    return this.cache;
  }

  getPredictor(): Predictor {
    return this.predictor;
  }

  getScorer(): Scorer {
    return this.scorer;
  }

  getRiskAnalyzer(): RiskAnalyzer {
    return this.riskAnalyzer;
  }

  getResourceEstimator(): ResourceEstimator {
    return this.resourceEstimator;
  }

  getParallelSimulator(): ParallelSimulator {
    return this.parallelSimulator;
  }

  getReportGenerator(): SimulationReport {
    return this.reportGenerator;
  }

  getPathExplorer(): PathExplorer {
    return this.pathExplorer;
  }

  getMCTS(): MonteCarloTS {
    return this.mcts;
  }

  private emit(event: SimulationEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch {
          // swallow handler errors
        }
      }
    }
  }

  private cancelAll(): void {
    for (const [id, active] of this.activeSimulations) {
      if (active.status === SimulationStatus.Running) {
        this.cancel(id);
      }
    }
  }

  private createEmptySnapshot(): Snapshot {
    return Snapshot.create({
      getAllEntities: () => [],
      getAllRelations: () => [],
      entityCount: () => 0,
      relationCount: () => 0,
      getVersion: () => 0,
    } as any);
  }

  private explorePaths(action: PathNode, options: SimulationOptions): SimulationPath[] {
    const snapshot = this.createEmptySnapshot();
    const strategy = options.strategy ?? "explore";

    let paths: SimulationPath[] = [];

    if (strategy === "explore" || strategy === "hybrid") {
      const exploredPaths = this.pathExplorer.explore(snapshot, {
        maxDepth: options.maxSteps ?? this.config.maxSteps,
        maxPaths: options.maxPaths ?? this.config.maxPaths,
      });
      paths.push(...exploredPaths);
    }

    if (strategy === "mcts" || strategy === "hybrid") {
      const mctsState: MCTSState = {
        snapshot,
        depth: 0,
        actionHistory: [],
        cumulativeReward: 0,
      };

      const searchResult = this.mcts.search(mctsState);
      if (searchResult.ok) {
        const mctsPath = this.mcts.getBestPath(searchResult.value);
        paths.push(mctsPath);
      }
    }

    for (const path of paths) {
      this.paths.set(path.getId(), path);
    }

    this.state.activePaths = paths.length;

    return paths;
  }

  private computeFinalScore(
    prediction: Result<import("./types.js").PredictionResult, SimulationError>,
    riskAssessment: Result<import("@paracosm/shared").RiskAssessment, SimulationError>,
    bestPath: SimulationPath | null
  ): SimulationScore {
    const predConfidence = prediction.ok ? prediction.value.confidence : 0.5;
    const predProbability = prediction.ok ? prediction.value.probability : 0.5;
    const overallRisk = riskAssessment.ok ? riskAssessment.value.overallRisk : 0;
    const pathScore = bestPath ? this.scorer.scorePath(bestPath) : 0.5;

    return {
      overall: predProbability * predConfidence * (1 - overallRisk) * 0.7 + pathScore * 0.3,
      feasibility: predProbability,
      efficiency: bestPath ? 1.0 / (1.0 + bestPath.getTotalCost()) : 0.5,
      risk: 1.0 - overallRisk,
      goalAlignment: predProbability * 0.8,
      constraintSatisfaction: 1.0 - overallRisk * 0.8,
      resourceUtilization: bestPath ? 1.0 / (1.0 + bestPath.getEstimatedDuration() / 1000) : 0.5,
      breakdown: {
        predictionConfidence: predConfidence,
        riskScore: overallRisk,
        pathScore,
      },
    };
  }

  private computeViolations(
    riskAssessment: Result<import("@paracosm/shared").RiskAssessment, SimulationError>,
    action: PathNode
  ): SimulationViolation[] {
    const violations: SimulationViolation[] = [];

    if (riskAssessment.ok) {
      const assessment = riskAssessment.value;
      if (assessment.overallRisk > this.config.riskThreshold) {
        violations.push({
          constraintId: "risk_threshold" as any,
          stepNumber: 0,
          severity: "critical",
          description: `Overall risk ${(assessment.overallRisk * 100).toFixed(1)}% exceeds threshold ${(this.config.riskThreshold * 100).toFixed(1)}%`,
          remediation: "Apply risk mitigation strategies or choose alternative action",
        });
      }

      for (const factor of assessment.highRiskFactors) {
        violations.push({
          constraintId: factor.id as any,
          stepNumber: 0,
          severity: factor.riskScore > 0.7 ? "critical" : "warning",
          description: factor.description,
          remediation: factor.mitigation,
        });
      }
    }

    if (action.cost > 2.0) {
      violations.push({
        constraintId: "cost_limit" as any,
        stepNumber: 0,
        severity: "warning",
        description: `Action cost ${action.cost.toFixed(2)} exceeds recommended limit`,
        remediation: "Optimize action parameters to reduce cost",
      });
    }

    return violations;
  }

  private computeInsights(
    prediction: Result<import("./types.js").PredictionResult, SimulationError>,
    paths: SimulationPath[]
  ): string[] {
    const insights: string[] = [];

    if (prediction.ok) {
      insights.push(`Predicted outcome: ${prediction.value.outcome} (confidence: ${(prediction.value.confidence * 100).toFixed(1)}%)`);

      if (prediction.value.sideEffects.length > 0) {
        insights.push(`${prediction.value.sideEffects.length} potential side effects identified`);
        for (const se of prediction.value.sideEffects.slice(0, 3)) {
          insights.push(`  - ${se.description} (probability: ${(se.probability * 100).toFixed(1)}%)`);
        }
      }
    }

    if (paths.length > 0) {
      insights.push(`Explored ${paths.length} possible execution paths`);
      const bestPath = this.pathExplorer.selectBest(paths, 1)[0];
      if (bestPath) {
        insights.push(`Best path has ${bestPath.getNodeCount()} steps with estimated cost ${bestPath.getTotalCost().toFixed(2)}`);
      }
    }

    return insights;
  }

  private computeRecommendations(
    riskAssessment: Result<import("@paracosm/shared").RiskAssessment, SimulationError>,
    bestPath: SimulationPath | null,
    paths: SimulationPath[]
  ): string[] {
    const recommendations: string[] = [];

    if (riskAssessment.ok && riskAssessment.value.overallRisk > 0.5) {
      recommendations.push("High risk detected; review and apply mitigation strategies before proceeding");
    }

    if (bestPath) {
      const bestRisk = bestPath.getTotalRisk();
      if (bestRisk > 0.5) {
        recommendations.push("Best path still carries significant risk; consider additional safeguards");
      }

      const bestCost = bestPath.getTotalCost();
      if (bestCost > 1.5) {
        recommendations.push("Best path has high cost; explore cost optimization opportunities");
      }
    }

    if (paths.length < 5) {
      recommendations.push("Limited path exploration; consider increasing exploration parameters");
    }

    if (recommendations.length === 0) {
      recommendations.push("Simulation results are favorable; proceed with the recommended path");
    }

    return recommendations;
  }
}
