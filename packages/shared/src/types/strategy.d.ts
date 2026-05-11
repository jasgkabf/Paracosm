export type GeneId = string;
export interface StrategyGene {
    id: GeneId;
    name: string;
    type: string;
    value: unknown;
    fitness: number;
    generation: number;
    parentIds: GeneId[];
    mutationCount: number;
    metadata: Record<string, unknown>;
    createdAt: Date;
}
export interface GenePool {
    genes: Map<GeneId, StrategyGene>;
    species: Map<string, Set<GeneId>>;
    generation: number;
    totalFitness: number;
    averageFitness: number;
    bestGeneId: GeneId;
    worstGeneId: GeneId;
    diversityIndex: number;
}
export interface FitnessScore {
    geneId: GeneId;
    raw: number;
    normalized: number;
    rank: number;
    components: Record<string, number>;
    timestamp: Date;
}
export interface EvolutionConfig {
    populationSize: number;
    maxGenerations: number;
    crossoverRate: number;
    mutationRate: number;
    elitismCount: number;
    tournamentSize: number;
    diversityThreshold: number;
    stagnationLimit: number;
    fitnessFunction: string;
    selectionMethod: 'tournament' | 'roulette' | 'rank' | 'sus';
    metadata: Record<string, unknown>;
}
export interface MutationOperator {
    id: string;
    name: string;
    type: 'gaussian' | 'uniform' | 'bitflip' | 'swap' | 'insert' | 'delete' | 'crossover_point';
    probability: number;
    strength: number;
    domain: string;
    metadata: Record<string, unknown>;
}
export interface CrossoverOperator {
    id: string;
    name: string;
    type: 'single_point' | 'two_point' | 'uniform' | 'blend' | 'simulated_binary';
    probability: number;
    metadata: Record<string, unknown>;
}
export interface EvolutionResult {
    id: string;
    generation: number;
    bestGene: StrategyGene;
    bestFitness: number;
    averageFitness: number;
    worstFitness: number;
    diversity: number;
    stagnationCount: number;
    improvements: number;
    duration: number;
    timestamp: Date;
}
export interface AdaptationResult {
    id: string;
    triggerGeneId: GeneId;
    adaptationType: 'mutation' | 'crossover' | 'selection' | 'migration';
    resultGeneId: GeneId;
    fitnessChange: number;
    successful: boolean;
    timestamp: Date;
}
//# sourceMappingURL=strategy.d.ts.map