import type {
  GeneId,
  GeneType,
  GeneExpression,
  FitnessScore,
  EvolutionConfig,
  EvolutionResult,
  AdaptationResult,
  MutationType,
  MutationOperator,
  CrossoverType,
  CrossoverOperator,
} from "@paracosm/shared";
import type { StrategyGene as SharedStrategyGene, GenePool as SharedGenePool } from "@paracosm/shared";

export type { GeneId, GeneType, GeneExpression, FitnessScore, EvolutionConfig, EvolutionResult, AdaptationResult };
export type { SharedStrategyGene as StrategyGene, SharedGenePool as GenePool };

export interface GeneInternal {
  id: GeneId;
  name: string;
  type: GeneType;
  description: string;
  expression: GeneExpression;
  fitness: number;
  generation: number;
  parentId: GeneId | null;
  origin: "initial" | "mutation" | "crossover" | "migration";
  active: boolean;
  applicability: string[];
  constraints: string[];
  targetGoals: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GenePoolData {
  genes: Array<{
    id: string;
    name: string;
    type: string;
    description: string;
    expression: GeneExpression;
    fitness: number;
    generation: number;
    parentId: string | null;
    origin: string;
    active: boolean;
    applicability: string[];
    constraints: string[];
    targetGoals: string[];
    createdAt: string;
    updatedAt: string;
  }>;
  generation: number;
  speciesCount: number;
  totalFitness: number;
  averageFitness: number;
  diversityIndex: number;
  stagnationCount: number;
  protectedIds: string[];
  version: number;
  checksum: string;
}

export interface EvolutionState {
  generation: number;
  bestFitness: number;
  averageFitness: number;
  worstFitness: number;
  diversityIndex: number;
  stagnationCount: number;
  lastMutationCount: number;
  lastCrossoverCount: number;
  totalMutations: number;
  totalCrossovers: number;
  startTime: string;
  lastUpdateTime: string;
}

export interface FitnessHistory {
  geneId: GeneId;
  entries: Array<{
    generation: number;
    overall: number;
    effectiveness: number;
    efficiency: number;
    robustness: number;
    novelty: number;
    simplicity: number;
    timestamp: string;
  }>;
  trend: "improving" | "declining" | "stable" | "volatile";
  averageDelta: number;
}

export interface AdaptationState {
  userId: string;
  adaptedWeights: ObjectiveWeights;
  patterns: UserPattern[];
  lastAdaptedAt: string;
  adaptationCount: number;
  effectiveness: number;
}

export type DomainType =
  | "general"
  | "creative"
  | "analytical"
  | "social"
  | "technical"
  | "strategic"
  | "operational";

export interface DomainProfile {
  domain: DomainType;
  characteristicFitnessWeights: ObjectiveWeights;
  typicalMutationRates: number;
  preferredCrossoverType: CrossoverType;
  populationSize: number;
  elitismRatio: number;
  diversityThreshold: number;
  stagnationPatience: number;
}

export interface ContextProfile {
  id: string;
  situation: string;
  domain: DomainType;
  urgency: number;
  complexity: number;
  resourceAvailability: number;
  constraints: string[];
  preferredGeneTypes: GeneType[];
  fitnessModifiers: Partial<ObjectiveWeights>;
  timestamp: string;
}

export interface EvolutionEvents {
  on(event: EvolutionEventName, handler: EvolutionEventHandler): void;
  off(event: EvolutionEventName, handler: EvolutionEventHandler): void;
  emit(event: EvolutionEvent): void;
}

export type EvolutionEventName =
  | "evolution:started"
  | "evolution:completed"
  | "evolution:generation"
  | "evolution:converged"
  | "evolution:stagnated"
  | "gene:created"
  | "gene:mutated"
  | "gene:crossover"
  | "gene:removed"
  | "fitness:updated"
  | "pool:pruned"
  | "pool:diversified"
  | "engine:initialized"
  | "engine:shutdown";

export interface EvolutionEvent {
  type: EvolutionEventName;
  timestamp: string;
  data: Record<string, unknown>;
}

export type EvolutionEventHandler = (event: EvolutionEvent) => void;

export interface SelectionConfig {
  method: "tournament" | "roulette" | "rank" | "elite" | "diversity";
  tournamentSize: number;
  elitismCount: number;
  diversityThreshold: number;
  selectionPressure: number;
}

export interface MutationConfig {
  pointRate: number;
  segmentRate: number;
  parameterRate: number;
  structureRate: number;
  adaptiveEnabled: boolean;
  minRate: number;
  maxRate: number;
  decayFactor: number;
}

export interface CrossoverConfig {
  method: "single_point" | "two_point" | "uniform" | "blend" | "ordered";
  rate: number;
  blendAlpha: number;
  maxGeneLength: number;
}

export interface ObjectiveWeights {
  effectiveness: number;
  efficiency: number;
  robustness: number;
  novelty: number;
  simplicity: number;
}

export interface UserPattern {
  userId: string;
  patternType: "preference" | "avoidance" | "frequency" | "sequence";
  geneId: string | null;
  geneType: GeneType | null;
  frequency: number;
  recency: number;
  strength: number;
  metadata: Record<string, unknown>;
  detectedAt: string;
}

export interface PoolStats {
  size: number;
  activeCount: number;
  inactiveCount: number;
  averageFitness: number;
  maxFitness: number;
  minFitness: number;
  fitnessVariance: number;
  diversityIndex: number;
  generation: number;
  speciesCount: number;
  typeDistribution: Record<string, number>;
  originDistribution: Record<string, number>;
}

export interface DiversityReport {
  overallDiversity: number;
  typeDiversity: number;
  fitnessDiversity: number;
  expressionDiversity: number;
  speciesCount: number;
  dominantType: GeneType | null;
  rareTypes: GeneType[];
  recommendations: string[];
}

export interface EvolutionTrend {
  generation: number;
  bestFitnessHistory: Array<{ generation: number; value: number }>;
  averageFitnessHistory: Array<{ generation: number; value: number }>;
  diversityHistory: Array<{ generation: number; value: number }>;
  direction: "improving" | "declining" | "stable";
  rate: number;
  predictedNextBest: number;
}

export interface TrendData {
  geneId: GeneId;
  dataPoints: Array<{ generation: number; fitness: number }>;
  slope: number;
  intercept: number;
  r2: number;
  trend: "improving" | "declining" | "stable";
  confidence: number;
}

export interface ConvergenceReport {
  converged: boolean;
  generation: number;
  stagnationGenerations: number;
  fitnessDelta: number;
  diversityDelta: number;
  convergenceCriteria: string[];
  recommendation: string;
}

export const DEFAULT_OBJECTIVE_WEIGHTS: ObjectiveWeights = {
  effectiveness: 0.3,
  efficiency: 0.2,
  robustness: 0.2,
  novelty: 0.15,
  simplicity: 0.15,
};

export const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  populationSize: 100,
  maxGenerations: 500,
  mutationRate: 0.1,
  crossoverRate: 0.7,
  elitismCount: 5,
  tournamentSize: 5,
  stagnationThreshold: 0.001,
  diversityThreshold: 0.3,
  fitnessThreshold: 0.95,
  maxGeneLength: 1024,
  selectionPressure: 1.5,
  migrationInterval: 50,
  migrationCount: 5,
};

export const DEFAULT_SELECTION_CONFIG: SelectionConfig = {
  method: "tournament",
  tournamentSize: 5,
  elitismCount: 5,
  diversityThreshold: 0.3,
  selectionPressure: 1.5,
};

export const DEFAULT_MUTATION_CONFIG: MutationConfig = {
  pointRate: 0.05,
  segmentRate: 0.02,
  parameterRate: 0.1,
  structureRate: 0.01,
  adaptiveEnabled: true,
  minRate: 0.001,
  maxRate: 0.5,
  decayFactor: 0.95,
};

export const DEFAULT_CROSSOVER_CONFIG: CrossoverConfig = {
  method: "single_point",
  rate: 0.7,
  blendAlpha: 0.5,
  maxGeneLength: 1024,
};
