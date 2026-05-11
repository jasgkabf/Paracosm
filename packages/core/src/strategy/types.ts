import type { EvolutionConfig, StrategyGene, GeneId, FitnessScore, EvolutionResult, AdaptationResult, MutationOperator, CrossoverOperator } from '@paracosm/shared';

export interface StrategyEngineConfig {
  defaultEvolutionConfig: EvolutionConfig;
  maxGenePoolSize: number;
  autoEvolve: boolean;
  persistenceEnabled: boolean;
  adaptationEnabled: boolean;
}

export const DEFAULT_STRATEGY_ENGINE_CONFIG: StrategyEngineConfig = {
  defaultEvolutionConfig: {
    populationSize: 50,
    maxGenerations: 100,
    crossoverRate: 0.7,
    mutationRate: 0.1,
    elitismCount: 2,
    tournamentSize: 5,
    diversityThreshold: 0.3,
    stagnationLimit: 20,
    fitnessFunction: 'default',
    selectionMethod: 'tournament',
    metadata: {},
  },
  maxGenePoolSize: 1000,
  autoEvolve: false,
  persistenceEnabled: false,
  adaptationEnabled: true,
};

export interface GenePoolStats {
  totalGenes: number;
  speciesCount: number;
  generation: number;
  averageFitness: number;
  bestFitness: number;
  worstFitness: number;
  diversityIndex: number;
}
