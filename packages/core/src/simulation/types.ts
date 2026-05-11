import type { SimulationConfig, SimulationState, SimulationResult, SimulationScore, RiskAssessment, ResourceEstimate } from '@paracosm/shared';

export interface SimulationEngineConfig {
  maxConcurrentSimulations: number;
  defaultConfig: SimulationConfig;
  cacheResults: boolean;
  cacheTtlMs: number;
  seed?: number;
}

export interface SimulationRun {
  id: string;
  config: SimulationConfig;
  state: SimulationState;
  result?: SimulationResult;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface PredictionResult {
  predictedOutcome: string;
  confidence: number;
  probability: number;
  keyFactors: string[];
  assumptions: string[];
}

export interface ScoringCriteria {
  weights: Record<string, number>;
  thresholds: Record<string, number>;
  penalties: Record<string, number>;
}

export const DEFAULT_SIMULATION_ENGINE_CONFIG: SimulationEngineConfig = {
  maxConcurrentSimulations: 10,
  defaultConfig: {
    maxPaths: 50,
    maxStepsPerPath: 20,
    timeHorizon: 3600000,
    branchingFactor: 4,
    pruningThreshold: 0.3,
    scoringWeights: {
      feasibility: 0.3,
      impact: 0.25,
      risk: 0.2,
      efficiency: 0.15,
      robustness: 0.1,
    },
    parallelWorkers: 4,
    metadata: {},
  },
  cacheResults: true,
  cacheTtlMs: 300000,
};
