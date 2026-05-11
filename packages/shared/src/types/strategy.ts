import type { Timestamped, Identified } from "./common.js";
import type { GoalId, ConstraintId } from "./world-model.js";

export type GeneId = string & { readonly __brand: unique symbol };

export enum GeneType {
  Heuristic = "heuristic",
  Rule = "rule",
  Pattern = "pattern",
  Policy = "policy",
  Procedure = "procedure",
}

export interface GeneExpression {
  condition: string;
  action: string;
  priority: number;
  weight: number;
}

export interface StrategyGene extends Identified, Timestamped {
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
  constraints: ConstraintId[];
  targetGoals: GoalId[];
}

export interface GenePool {
  genes: Map<GeneId, StrategyGene>;
  generation: number;
  speciesCount: number;
  totalFitness: number;
  averageFitness: number;
  diversityIndex: number;
  stagnationCount: number;
}

export interface FitnessScore {
  geneId: GeneId;
  overall: number;
  effectiveness: number;
  efficiency: number;
  robustness: number;
  novelty: number;
  simplicity: number;
  evaluations: number;
  confidence: number;
  lastEvaluated: string;
}

export interface EvolutionConfig {
  populationSize: number;
  maxGenerations: number;
  mutationRate: number;
  crossoverRate: number;
  elitismCount: number;
  tournamentSize: number;
  stagnationThreshold: number;
  diversityThreshold: number;
  fitnessThreshold: number;
  maxGeneLength: number;
  selectionPressure: number;
  migrationInterval: number;
  migrationCount: number;
}

export enum MutationType {
  Point = "point",
  Insert = "insert",
  Delete = "delete",
  Invert = "invert",
  Swap = "swap",
  Parametric = "parametric",
}

export interface MutationOperator {
  type: MutationType;
  probability: number;
  magnitude: number;
  targetRegion: "condition" | "action" | "priority" | "weight" | "any";
  description: string;
}

export enum CrossoverType {
  SinglePoint = "single_point",
  TwoPoint = "two_point",
  Uniform = "uniform",
  Blend = "blend",
  Arithmetic = "arithmetic",
}

export interface CrossoverOperator {
  type: CrossoverType;
  probability: number;
  blendFactor: number;
  description: string;
}

export interface EvolutionResult {
  generation: number;
  bestGeneId: GeneId;
  bestFitness: number;
  averageFitness: number;
  worstFitness: number;
  diversityIndex: number;
  mutationsApplied: number;
  crossoversApplied: number;
  genesCreated: number;
  genesRemoved: number;
  stagnationDetected: boolean;
  duration: number;
  timestamp: string;
}

export interface AdaptationResult {
  geneId: GeneId;
  previousFitness: number;
  newFitness: number;
  fitnessDelta: number;
  adaptationType: "improvement" | "degradation" | "neutral";
  changesApplied: string[];
  generation: number;
  timestamp: string;
}

export interface StrategyEvolution extends Identified, Timestamped {
  config: EvolutionConfig;
  pool: GenePool;
  fitnessScores: Map<GeneId, FitnessScore>;
  mutationOperators: MutationOperator[];
  crossoverOperators: CrossoverOperator[];
  evolutionHistory: EvolutionResult[];
  adaptationHistory: AdaptationResult[];
  currentGeneration: number;
  bestGeneId: GeneId | null;
  bestFitness: number;
}
