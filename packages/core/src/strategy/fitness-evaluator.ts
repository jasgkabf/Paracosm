import type { StrategyGene, FitnessScore } from '@paracosm/shared';
import { generateId, createLogger } from '@paracosm/shared';

const logger = createLogger('FitnessEvaluator');

export type FitnessFunction = (gene: StrategyGene, context?: Record<string, unknown>) => number;

export class FitnessEvaluator {
  private functions: Map<string, FitnessFunction> = new Map();
  private cache: Map<string, FitnessScore> = new Map();

  constructor() {
    this.registerDefaultFunctions();
  }

  private registerDefaultFunctions(): void {
    this.register('default', (gene) => gene.fitness);
    this.register('complexity', (gene) => {
      const valueStr = JSON.stringify(gene.value);
      const complexity = valueStr.length;
      return 1 / (1 + complexity * 0.01);
    });
    this.register('diversity', (gene, context) => {
      if (!context || !context.population) return 0.5;
      const population = context.population as StrategyGene[];
      const similar = population.filter((g) => JSON.stringify(g.value) === JSON.stringify(gene.value));
      const uniqueness = 1 - (similar.length / population.length);
      return uniqueness;
    });
    this.register('balanced', (gene, context) => {
      const baseFitness = gene.fitness;
      const valueStr = JSON.stringify(gene.value);
      const complexityPenalty = valueStr.length * 0.001;
      const mutationPenalty = gene.mutationCount * 0.01;
      return Math.max(baseFitness - complexityPenalty - mutationPenalty, 0);
    });
  }

  register(name: string, fn: FitnessFunction): void {
    this.functions.set(name, fn);
    logger.info(`Registered fitness function: ${name}`);
  }

  evaluate(gene: StrategyGene, functionName: string = 'default', context?: Record<string, unknown>): FitnessScore {
    const cacheKey = `${gene.id}_${functionName}_${gene.generation}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const fn = this.functions.get(functionName);
    if (!fn) {
      logger.warn(`Fitness function ${functionName} not found, using default`);
      return this.evaluate(gene, 'default', context);
    }
    const raw = fn(gene, context);
    const normalized = Math.min(Math.max(raw, 0), 1);
    const score: FitnessScore = {
      geneId: gene.id,
      raw,
      normalized,
      rank: 0,
      components: { [functionName]: normalized },
      timestamp: new Date(),
    };
    this.cache.set(cacheKey, score);
    return score;
  }

  evaluatePopulation(genes: StrategyGene[], functionName: string = 'default', context?: Record<string, unknown>): FitnessScore[] {
    const scores = genes.map((gene) => this.evaluate(gene, functionName, { ...context, population: genes }));
    scores.sort((a, b) => b.normalized - a.normalized);
    scores.forEach((score, index) => { score.rank = index + 1; });
    return scores;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
