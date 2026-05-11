import type {
  CSEPhase,
  CSEStatus,
  CSEState,
  CSEContext,
  CSEIteration,
  ConstructResult,
  SimulateResult,
  ExecuteResult,
  ReflectResult,
  EvolveResult,
  WorldModelState,
  Entity,
  EntityId,
  Goal,
  Constraint,
  SimulationPath,
  SimulationResult,
  DebateResult,
  EvolutionResult,
  GeneId,
  PersonaCombination,
  PersonaId,
} from "@paracosm/shared";
import type { Result } from "@paracosm/shared";

export type {
  CSEPhase,
  CSEStatus,
  CSEState,
  CSEContext,
  CSEIteration,
  ConstructResult,
  SimulateResult,
  ExecuteResult,
  ReflectResult,
  EvolveResult,
};

export interface PipelineStage {
  name: string;
  execute: (input: unknown) => Promise<unknown>;
  rollback?: (input: unknown) => Promise<void>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface PipelineConfig {
  name: string;
  stages: PipelineStage[];
  continueOnError: boolean;
  maxConcurrency: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface StateTransition {
  from: string;
  to: string;
  timestamp: string;
  guardResult: boolean;
  metadata: Record<string, unknown>;
}

export interface ContextWindow {
  id: string;
  query: string;
  entities: Entity[];
  relations: Array<{
    sourceId: EntityId;
    targetId: EntityId;
    type: string;
    weight: number;
  }>;
  goals: Goal[];
  constraints: Constraint[];
  tokenCount: number;
  maxTokens: number;
  priority: number;
  createdAt: string;
}

export interface OrchestratorConfig {
  maxIterations: number;
  iterationTimeoutMs: number;
  phaseTimeoutMs: number;
  contextWindowTokens: number;
  enableParallelPhases: boolean;
  maxConcurrentSimulations: number;
  retryAttempts: number;
  retryDelayMs: number;
  persistenceEnabled: boolean;
  persistencePath: string;
  checkpointIntervalMs: number;
}

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  maxIterations: 10,
  iterationTimeoutMs: 300000,
  phaseTimeoutMs: 60000,
  contextWindowTokens: 8000,
  enableParallelPhases: false,
  maxConcurrentSimulations: 4,
  retryAttempts: 3,
  retryDelayMs: 1000,
  persistenceEnabled: false,
  persistencePath: "./data/orchestrator",
  checkpointIntervalMs: 30000,
};

export type OrchestratorEventName =
  | "orchestrator:initialized"
  | "orchestrator:started"
  | "orchestrator:paused"
  | "orchestrator:resumed"
  | "orchestrator:cancelled"
  | "orchestrator:completed"
  | "orchestrator:failed"
  | "phase:started"
  | "phase:completed"
  | "phase:failed"
  | "iteration:started"
  | "iteration:completed"
  | "iteration:failed"
  | "progress:updated"
  | "state:changed"
  | "error:occurred";

export interface OrchestratorEvent {
  type: OrchestratorEventName;
  timestamp: string;
  data: Record<string, unknown>;
}

export type OrchestratorEventHandler = (event: OrchestratorEvent) => void;

export interface OrchestratorEvents {
  on(event: OrchestratorEventName, handler: OrchestratorEventHandler): void;
  off(event: OrchestratorEventName, handler: OrchestratorEventHandler): void;
  emit(event: OrchestratorEvent): void;
}

export interface PhaseResult {
  phase: CSEPhase;
  success: boolean;
  duration: number;
  error: string | null;
  metadata: Record<string, unknown>;
}

export interface ProgressInfo {
  taskId: string;
  phase: CSEPhase;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  startTime: string | null;
  endTime: string | null;
  estimatedCompletion: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
}

export interface AnalysisResult {
  intent: string;
  entities: Array<{ name: string; type: string; confidence: number }>;
  keywords: string[];
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  complexity: number;
  domain: string;
  urgency: number;
  scope: "narrow" | "moderate" | "broad";
  assumptions: string[];
  ambiguities: string[];
}

export interface ContextPlan {
  requiredEntities: string[];
  requiredRelations: string[];
  requiredGoals: string[];
  requiredConstraints: string[];
  estimatedTokens: number;
  priorityOrder: string[];
}

export interface DebateContextInternal {
  topic: string;
  personaIds: PersonaId[];
  rounds: number;
  timeLimitMs: number;
  consensusThreshold: number;
}

export interface SimulationPathInternal {
  path: SimulationPath;
  score: number;
  risk: number;
  feasibility: number;
  novelty: number;
}

export interface ScoredPath {
  path: SimulationPath;
  overallScore: number;
  feasibilityScore: number;
  riskScore: number;
  goalAlignmentScore: number;
  constraintSatisfactionScore: number;
  efficiencyScore: number;
  rank: number;
}

export interface SimulationReportInternal {
  bestPathId: string;
  bestScore: number;
  pathsExplored: number;
  pathsPruned: number;
  riskAssessment: {
    overallRisk: number;
    highRiskFactors: string[];
    mitigationStrategies: string[];
  };
  recommendations: string[];
  duration: number;
}

export interface UncertaintyHandling {
  pathId: string;
  uncertaintyLevel: number;
  contingencies: Array<{
    condition: string;
    alternativeAction: string;
    probability: number;
  }>;
  fallbackStrategy: string;
  monitoringPoints: string[];
}

export interface StepResult {
  stepIndex: number;
  action: string;
  success: boolean;
  duration: number;
  output: unknown;
  error: string | null;
}

export interface ToolResultInternal {
  toolId: string;
  success: boolean;
  data: unknown;
  error: string | null;
  executionTimeMs: number;
}

export interface RecoveryAction {
  type: "retry" | "skip" | "rollback" | "abort" | "alternative";
  description: string;
  maxRetries: number;
  currentRetry: number;
  alternativeStep: StepResult | null;
}

export interface Comparison {
  matchScore: number;
  deviations: Array<{
    field: string;
    expected: unknown;
    actual: unknown;
    severity: "low" | "medium" | "high";
  }>;
  overallAssessment: "excellent" | "good" | "acceptable" | "poor" | "critical";
}

export interface DeviationAnalysis {
  totalDeviations: number;
  criticalDeviations: number;
  deviationCategories: Record<string, number>;
  rootCauses: string[];
  impactAssessment: string;
  correctiveActions: string[];
}

export interface EvolutionResultInternal {
  generation: number;
  bestGeneId: GeneId | null;
  bestFitness: number;
  averageFitness: number;
  worstFitness: number;
  diversityIndex: number;
  mutationsApplied: number;
  crossoversApplied: number;
  genesCreated: number;
  genesRetired: number;
  stagnationDetected: boolean;
  duration: number;
}

export interface EngineDependencies {
  worldModelEngine: unknown;
  simulationEngine: unknown;
  personaMeshEngine: unknown;
  genomeEngine: unknown;
  genePool: unknown;
  personaRegistry: unknown;
  genePersistence: unknown;
  llmRouter: unknown;
}
