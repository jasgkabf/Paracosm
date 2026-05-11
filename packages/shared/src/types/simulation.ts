import type { Timestamped, Identified } from "./common.js";
import type { EntityId, GoalId, ConstraintId } from "./world-model.js";

export interface SimulationStep {
  stepNumber: number;
  timestamp: string;
  entityId: EntityId;
  action: string;
  parameters: Record<string, unknown>;
  result: string;
  duration: number;
  stateDelta: Record<string, unknown>;
}

export interface SimulationPath {
  id: string;
  steps: SimulationStep[];
  probability: number;
  totalDuration: number;
  branchPoint: number | null;
  parentPathId: string | null;
  childPathIds: string[];
}

export interface SimulationSnapshot {
  id: string;
  pathId: string;
  stepNumber: number;
  state: Record<string, unknown>;
  entityStates: Map<EntityId, Record<string, unknown>>;
  activeConstraints: ConstraintId[];
  activeGoals: GoalId[];
  timestamp: string;
}

export interface SimulationScore {
  overall: number;
  feasibility: number;
  efficiency: number;
  risk: number;
  goalAlignment: number;
  constraintSatisfaction: number;
  resourceUtilization: number;
  breakdown: Record<string, number>;
}

export interface SimulationResult {
  pathId: string;
  score: SimulationScore;
  finalState: SimulationSnapshot;
  violations: SimulationViolation[];
  insights: string[];
  recommendations: string[];
  executionTime: number;
}

export interface SimulationViolation {
  constraintId: ConstraintId;
  stepNumber: number;
  severity: "warning" | "error" | "critical";
  description: string;
  remediation: string | null;
}

export enum SimulationStatus {
  Queued = "queued",
  Running = "running",
  Paused = "paused",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
}

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

export interface RiskFactor {
  id: string;
  name: string;
  description: string;
  probability: number;
  impact: number;
  riskScore: number;
  mitigation: string;
  category: string;
}

export interface RiskAssessment {
  overallRisk: number;
  riskFactors: RiskFactor[];
  highRiskFactors: RiskFactor[];
  mitigationStrategies: string[];
  confidence: number;
  assessedAt: string;
}

export interface ResourceEstimate {
  cpuMs: number;
  memoryBytes: number;
  networkBytes: number;
  storageBytes: number;
  apiCalls: number;
  tokenCount: number;
  estimatedCostUsd: number;
}

export interface Simulation extends Identified, Timestamped {
  config: SimulationConfig;
  state: SimulationState;
  paths: SimulationPath[];
  results: SimulationResult[];
  riskAssessment: RiskAssessment | null;
  resourceEstimate: ResourceEstimate | null;
}
