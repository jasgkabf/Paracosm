import type {
  SimulationStep as SharedSimulationStep,
  SimulationPath as SharedSimulationPath,
  SimulationSnapshot,
  SimulationScore,
  SimulationResult,
  SimulationViolation,
  SimulationConfig as SharedSimulationConfig,
  SimulationState as SharedSimulationState,
  RiskFactor,
  RiskAssessment,
  ResourceEstimate,
  EntityId,
  GoalId,
  ConstraintId,
} from "@paracosm/shared";
import type { SimulationStatus } from "@paracosm/shared";

export type {
  SharedSimulationStep as SimulationStep,
  SharedSimulationPath as SimulationPath,
  SimulationSnapshot,
  SimulationScore,
  SimulationResult,
  SimulationViolation,
  RiskFactor,
  RiskAssessment,
  ResourceEstimate,
};

export { SimulationStatus };

export interface SimulationConfig {
  maxSteps: number;
  maxPaths: number;
  timeLimitMs: number;
  branchFactor: number;
  pruningThreshold: number;
  explorationRate: number;
  seed: number | null;
  snapshotInterval: number;
  parallelPaths: number;
  earlyTermination: boolean;
  earlyTerminationThreshold: number;
  mctsIterations: number;
  mctsExplorationParam: number;
  cacheEnabled: boolean;
  cacheTtlMs: number;
  cacheMaxSize: number;
  riskThreshold: number;
  resourceBudget: ResourceBudget | null;
}

export interface SimulationState {
  status: SimulationStatus;
  currentStep: number;
  totalSteps: number;
  activePaths: number;
  completedPaths: number;
  startTime: string | null;
  endTime: string | null;
  progress: number;
  error: string | null;
}

export interface PathNode {
  id: string;
  action: string;
  parameters: Record<string, unknown>;
  entityId: EntityId;
  timestamp: string;
  stateDelta: Record<string, unknown>;
  cost: number;
  risk: number;
  duration: number;
}

export interface PathEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  probability: number;
  condition: string;
  transitionCost: number;
}

export interface PredictionModel {
  id: string;
  name: string;
  version: number;
  accuracy: number;
  sampleSize: number;
  lastTrainedAt: string;
  predictions: Map<string, number>;
  confidenceThreshold: number;
}

export interface ScoreWeights {
  feasibility: number;
  efficiency: number;
  risk: number;
  goalAlignment: number;
  constraintSatisfaction: number;
  resourceUtilization: number;
  novelty: number;
  robustness: number;
}

export interface SimulationCache {
  key: string;
  result: SimulationResult;
  createdAt: string;
  expiresAt: string;
  accessCount: number;
  sizeBytes: number;
  compressed: boolean;
}

export interface SimulationReport {
  id: string;
  simulationId: string;
  exploredPathsCount: number;
  bestPathId: string | null;
  bestPathScore: number;
  averageScore: number;
  scoreVariance: number;
  riskAnalysis: RiskAnalysis;
  costAnalysis: CostAnalysis;
  recommendations: string[];
  generatedAt: string;
  executionTimeMs: number;
  pathComparison: PathComparison | null;
}

export interface RiskAnalysis {
  overallRisk: number;
  highRiskPaths: number;
  mediumRiskPaths: number;
  lowRiskPaths: number;
  topRiskFactors: RiskFactor[];
  riskDistribution: Map<string, number>;
}

export interface CostAnalysis {
  totalEstimatedCost: number;
  averageCostPerPath: number;
  minimumCostPath: string | null;
  costDistribution: Map<string, number>;
  tokenEstimate: TokenEstimate;
}

export interface TokenEstimate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface PathComparison {
  bestVsAverage: number;
  bestVsWorst: number;
  paretoOptimalCount: number;
  dominatedCount: number;
  tradeoffs: Tradeoff[];
}

export interface Tradeoff {
  dimension: string;
  pathAId: string;
  pathBId: string;
  pathAValue: number;
  pathBValue: number;
  difference: number;
}

export interface SimulationEvents {
  on(event: SimulationEventName, handler: SimulationEventHandler): void;
  off(event: SimulationEventName, handler: SimulationEventHandler): void;
  emit(event: SimulationEvent): void;
}

export type SimulationEventName =
  | "simulation:started"
  | "simulation:completed"
  | "simulation:failed"
  | "simulation:cancelled"
  | "simulation:progress"
  | "path:explored"
  | "path:pruned"
  | "path:selected"
  | "step:executed"
  | "snapshot:created"
  | "snapshot:restored"
  | "cache:hit"
  | "cache:miss"
  | "risk:threshold-exceeded"
  | "engine:initialized"
  | "engine:shutdown";

export interface SimulationEvent {
  type: SimulationEventName;
  timestamp: string;
  data: Record<string, unknown>;
}

export type SimulationEventHandler = (event: SimulationEvent) => void;

export interface RiskMatrix {
  dimensions: string[];
  grid: number[][];
  labels: string[];
  maxValue: number;
}

export interface ResourceBudget {
  maxTokens: number;
  maxTimeMs: number;
  maxCostUsd: number;
  maxMemoryBytes: number;
  maxApiCalls: number;
  priorityWeights: Map<string, number>;
}

export interface SnapshotDiff {
  addedEntities: string[];
  removedEntities: string[];
  modifiedEntities: Array<{ id: string; field: string; before: unknown; after: unknown }>;
  addedRelations: string[];
  removedRelations: string[];
  modifiedRelations: Array<{ id: string; field: string; before: unknown; after: unknown }>;
  addedConstraints: string[];
  removedConstraints: string[];
  addedGoals: string[];
  removedGoals: string[];
  checksumDelta: string;
}

export interface CompressedSnapshot {
  id: string;
  timestamp: string;
  version: number;
  data: string;
  originalSize: number;
  compressedSize: number;
  checksum: string;
}

export interface SnapshotPatch {
  targetSnapshotId: string;
  diffs: SnapshotDiff;
  createdAt: string;
}

export interface PredictionResult {
  outcome: string;
  probability: number;
  confidence: number;
  sideEffects: SideEffect[];
  costEstimate: CostEstimate;
  durationEstimate: DurationEstimate;
  uncertaintyRange: UncertaintyRange;
}

export interface SideEffect {
  id: string;
  description: string;
  probability: number;
  impact: number;
  affectedEntities: EntityId[];
  reversible: boolean;
}

export interface CostEstimate {
  minimum: number;
  expected: number;
  maximum: number;
  confidence: number;
  breakdown: Map<string, number>;
}

export interface DurationEstimate {
  minimumMs: number;
  expectedMs: number;
  maximumMs: number;
  confidence: number;
  breakdown: Map<string, number>;
}

export interface UncertaintyRange {
  lowerBound: number;
  upperBound: number;
  confidenceLevel: number;
  distribution: "normal" | "uniform" | "triangular";
  standardDeviation: number;
}

export interface MultiCriteriaResult {
  overallScore: number;
  dimensionScores: Map<string, number>;
  dimensionWeights: Map<string, number>;
  dominatedBy: string[];
  dominates: string[];
  isParetoOptimal: boolean;
}

export interface TradeoffReport {
  paths: string[];
  dimensions: string[];
  matrix: Map<string, Map<string, number>>;
  paretoOptimal: string[];
  dominated: string[];
  tradeoffs: Tradeoff[];
  summary: string;
}

export interface Hazard {
  id: string;
  name: string;
  description: string;
  category: string;
  likelihood: number;
  impact: number;
  riskScore: number;
  affectedEntities: EntityId[];
  detectability: number;
}

export interface Impact {
  severity: "low" | "medium" | "high" | "critical";
  score: number;
  scope: string[];
  reversible: boolean;
  recoveryTimeMs: number;
  financialCost: number;
}

export interface Likelihood {
  probability: number;
  frequency: "rare" | "unlikely" | "possible" | "likely" | "almost_certain";
  historicalOccurrences: number;
  trendDirection: "increasing" | "stable" | "decreasing";
}

export interface Mitigation {
  id: string;
  hazardId: string;
  strategy: string;
  effectiveness: number;
  cost: number;
  implementationTime: number;
  residualRisk: number;
  priority: number;
}

export interface TimeEstimate {
  minimumMs: number;
  expectedMs: number;
  maximumMs: number;
  confidence: number;
}

export interface MemoryEstimate {
  minimumBytes: number;
  expectedBytes: number;
  maximumBytes: number;
  confidence: number;
}

export interface OptimizedPlan {
  actions: Array<{
    action: string;
    parameters: Record<string, unknown>;
    estimatedTokens: number;
    estimatedTimeMs: number;
    estimatedCostUsd: number;
    estimatedMemoryBytes: number;
    priority: number;
  }>;
  totalTokens: number;
  totalTimeMs: number;
  totalCostUsd: number;
  totalMemoryBytes: number;
  withinBudget: boolean;
  savings: Map<string, number>;
}

export interface AggregatedResult {
  results: SimulationResult[];
  averageScore: number;
  bestScore: number;
  worstScore: number;
  scoreVariance: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  totalExecutionTimeMs: number;
}

export interface VisualizationData {
  nodes: Array<{ id: string; label: string; x: number; y: number; score: number }>;
  edges: Array<{ source: string; target: string; weight: number }>;
  highlights: string[];
  metadata: Record<string, unknown>;
}

export interface ComparisonReport {
  paths: Array<{
    pathId: string;
    score: number;
    cost: number;
    risk: number;
    duration: number;
    rank: number;
  }>;
  bestByScore: string;
  bestByCost: string;
  bestByRisk: string;
  bestByDuration: string;
  consensus: string | null;
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  maxSteps: 100,
  maxPaths: 50,
  timeLimitMs: 30000,
  branchFactor: 3,
  pruningThreshold: 0.3,
  explorationRate: 0.2,
  seed: null,
  snapshotInterval: 10,
  parallelPaths: 4,
  earlyTermination: true,
  earlyTerminationThreshold: 0.95,
  mctsIterations: 1000,
  mctsExplorationParam: 1.414,
  cacheEnabled: true,
  cacheTtlMs: 300000,
  cacheMaxSize: 100,
  riskThreshold: 0.7,
  resourceBudget: null,
};

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  feasibility: 0.2,
  efficiency: 0.15,
  risk: 0.2,
  goalAlignment: 0.2,
  constraintSatisfaction: 0.1,
  resourceUtilization: 0.05,
  novelty: 0.05,
  robustness: 0.05,
};
