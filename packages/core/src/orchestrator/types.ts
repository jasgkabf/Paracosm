import type { CSEPhase, CSEContext, CSEState, ConstructResult, SimulateResult, ExecuteResult, ReflectResult, EvolveResult } from '@paracosm/shared';

export interface OrchestratorConfig {
  maxIterations: number;
  tokenBudget: number;
  autoTransition: boolean;
  phaseTimeoutMs: number;
  persistState: boolean;
}

export interface PhaseTransition {
  from: CSEPhase;
  to: CSEPhase;
  timestamp: Date;
  duration: number;
  reason: string;
}

export interface PipelineStep {
  id: string;
  name: string;
  phase: CSEPhase;
  handler: string;
  timeout: number;
  retries: number;
  metadata: Record<string, unknown>;
}

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  maxIterations: 10,
  tokenBudget: 100000,
  autoTransition: true,
  phaseTimeoutMs: 60000,
  persistState: false,
};
