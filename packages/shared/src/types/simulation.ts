export interface SimulationSnapshot {
  id: string;
  timestamp: Date;
  state: Record<string, unknown>;
  metrics: Record<string, number>;
  events: string[];
  metadata: Record<string, unknown>;
}

export interface SimulationStep {
  stepNumber: number;
  snapshot: SimulationSnapshot;
  duration: number;
  transitions: string[];
  metadata: Record<string, unknown>;
}

export interface SimulationPath {
  id: string;
  name: string;
  steps: SimulationStep[];
  probability: number;
  outcome: string;
  totalDuration: number;
  metadata: Record<string, unknown>;
}

export interface SimulationScore {
  pathId: string;
  overall: number;
  feasibility: number;
  impact: number;
  risk: number;
  efficiency: number;
  robustness: number;
  breakdown: Record<string, number>;
}

export interface SimulationResult {
  id: string;
  paths: SimulationPath[];
  scores: SimulationScore[];
  bestPathId: string;
  worstPathId: string;
  averageScore: number;
  confidence: number;
  duration: number;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface SimulationConfig {
  maxPaths: number;
  maxStepsPerPath: number;
  timeHorizon: number;
  branchingFactor: number;
  pruningThreshold: number;
  scoringWeights: Record<string, number>;
  parallelWorkers: number;
  seed?: number;
  metadata: Record<string, unknown>;
}

export type SimulationState =
  | 'idle'
  | 'initializing'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface RiskAssessment {
  id: string;
  pathId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: Array<{
    name: string;
    probability: number;
    impact: number;
    description: string;
    mitigation: string;
  }>;
  overallRiskScore: number;
  timestamp: Date;
}

export interface ResourceEstimate {
  cpuCores: number;
  memoryMB: number;
  durationMs: number;
  costEstimate: number;
  tokenEstimate: number;
}
