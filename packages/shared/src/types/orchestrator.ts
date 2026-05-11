import type { Timestamped, Identified } from "./common.js";
import type { WorldModelState } from "./world-model.js";
import type { PersonaConfig, DebateResult } from "./persona.js";
import type { SimulationConfig, SimulationResult, RiskAssessment } from "./simulation.js";
import type { EvolutionConfig, EvolutionResult as StrategyEvolutionResult } from "./strategy.js";

export enum CSEPhase {
  Construct = "CONSTRUCT",
  Simulate = "SIMULATE",
  Execute = "EXECUTE",
  Reflect = "REFLECT",
  Evolve = "EVOLVE",
}

export interface CSEContext {
  sessionId: string;
  userId: string;
  parentSessionId: string | null;
  phase: CSEPhase;
  iteration: number;
  maxIterations: number;
  startTime: string;
  deadline: string | null;
  worldModel: WorldModelState;
  personaConfig: PersonaConfig;
  simulationConfig: SimulationConfig;
  evolutionConfig: EvolutionConfig;
  metadata: Record<string, unknown>;
}

export enum CSEStatus {
  Initialized = "initialized",
  Running = "running",
  Paused = "paused",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
}

export interface CSEState {
  status: CSEStatus;
  currentPhase: CSEPhase;
  iteration: number;
  phaseHistory: CSEPhase[];
  phaseStartTime: string | null;
  totalDuration: number;
  error: string | null;
}

export interface ConstructResult {
  worldModel: WorldModelState;
  entitiesCreated: number;
  relationsCreated: number;
  constraintsIdentified: number;
  goalsDefined: number;
  assumptions: string[];
  confidence: number;
  duration: number;
}

export interface SimulateResult {
  simulations: SimulationResult[];
  bestPath: SimulationResult | null;
  riskAssessment: RiskAssessment | null;
  pathsExplored: number;
  pathsPruned: number;
  duration: number;
}

export interface ExecuteResult {
  actionsTaken: string[];
  worldModelUpdates: WorldModelState;
  successRate: number;
  unexpectedEvents: string[];
  adaptationsRequired: number;
  duration: number;
}

export interface ReflectResult {
  debateResult: DebateResult | null;
  lessonsLearned: string[];
  performanceScore: number;
  improvementAreas: string[];
  strengths: string[];
  recommendations: string[];
  duration: number;
}

export interface EvolveResult {
  evolutionResult: StrategyEvolutionResult | null;
  genesImproved: number;
  genesCreated: number;
  genesRetired: number;
  fitnessImprovement: number;
  diversityChange: number;
  duration: number;
}

export interface CSEIteration {
  iteration: number;
  construct: ConstructResult;
  simulate: SimulateResult;
  execute: ExecuteResult;
  reflect: ReflectResult;
  evolve: EvolveResult;
  totalDuration: number;
  timestamp: string;
}

export interface CSEOrchestrator extends Identified, Timestamped {
  context: CSEContext;
  state: CSEState;
  iterations: CSEIteration[];
  currentIteration: CSEIteration | null;
}
