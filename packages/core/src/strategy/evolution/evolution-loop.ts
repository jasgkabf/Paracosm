import type { StrategyGene, EvolutionConfig, EvolutionResult } from '@paracosm/shared';
import { generateId, ok, err, type Result, createLogger } from '@paracosm/shared';
import { GenePool } from '../gene-pool.js';
import { FitnessEvaluator } from '../fitness-evaluator.js';
import { Selector } from './selector.js';
import { Mutator } from './mutator.js';
import { Crossover } from './crossover.js';

const logger = createLogger('EvolutionLoop');

export class EvolutionLoop {
  private config: EvolutionConfig;
  private pool: GenePool;
  private evaluator: FitnessEvaluator;
  private selector: Selector;
  private mutator: Mutator;
  private crossover: Crossover;
  private stagnationCount: number = 0;
  private lastBestFitness: number = -Infinity;
  private history: EvolutionResult[] = [];

  constructor(config: EvolutionConfig, pool: GenePool, evaluator: FitnessEvaluator) {
    this.config = config;
    this.pool = pool;
    this.evaluator = evaluator;
    this.selector = new Selector(config);
    this.mutator = new Mutator(config.mutationRate);
    this.crossover = new Crossover(config.crossoverRate);
  }

  run(generations?: number): Result<EvolutionResult> {
    const maxGen = generations ?? this.config.maxGenerations;
    const startTime = Date.now();
    let improvements = 0;
    for (let gen = 0; gen < maxGen; gen++) {
      const genResult = this.runGeneration();
      if (!genResult.ok) {
        return err(genResult.err);
      }
      this.history.push(genResult.value);
      if (genResult.value.bestFitness > this.lastBestFitness + 0.001) {
        improvements++;
        this.lastBestFitness = genResult.value.bestFitness;
        this.stagnationCount = 0;
      } else {
        this.stagnationCount++;
      }
      if (this.stagnationCount >= this.config.stagnationLimit) {
        logger.info(`Evolution stopped due to stagnation at generation ${gen}`);
        break;
      }
      const diversity = this.pool.getDiversityIndex();
      if (diversity < this.config.diversityThreshold) {
        this.injectDiversity();
      }
    }
    const bestGene = this.pool.getTopGenes(1)[0];
    const finalResult: EvolutionResult = {
      id: generateId(),
      generation: this.pool.getGeneration(),
      bestGene: bestGene ?? {
        id: '',
        name: '',
        type: '',
        value: null,
        fitness: 0,
        generation: 0,
        parentIds: [],
        mutationCount: 0,
        metadata: {},
        createdAt: new Date(),
      },
      bestFitness: this.lastBestFitness,
      averageFitness: this.pool.getAverageFitness(),
      worstFitness: this.pool.getWorstFitness(),
      diversity: this.pool.getDiversityIndex(),
      stagnationCount: this.stagnationCount,
      improvements,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };
    return ok(finalResult);
  }

  private runGeneration(): Result<EvolutionResult> {
    const startTime = Date.now();
    const allGenes = this.pool.getAllGenes();
    if (allGenes.length < 2) {
      return err(new Error('Need at least 2 genes to evolve'));
    }
    const scores = this.evaluator.evaluatePopulation(allGenes, this.config.fitnessFunction);
    for (const score of scores) {
      const gene = this.pool.getGene(score.geneId);
      if (gene) {
        this.pool.updateGene(gene.id, { fitness: score.normalized });
      }
    }
    const elite = this.pool.getTopGenes(this.config.elitismCount);
    const selected = this.selector.select(allGenes, this.config.populationSize - this.config.elitismCount);
    const children = this.crossover.crossoverPopulation(selected);
    const mutated = this.mutator.mutatePopulation(children);
    const newPopulation = [...elite, ...mutated];
    this.pool.clear();
    for (const gene of newPopulation) {
      this.pool.addGene(gene);
    }
    this.pool.incrementGeneration();
    const bestGene = this.pool.getTopGenes(1)[0];
    return ok({
      id: generateId(),
      generation: this.pool.getGeneration(),
      bestGene: bestGene ?? allGenes[0],
      bestFitness: this.pool.getBestFitness(),
      averageFitness: this.pool.getAverageFitness(),
      worstFitness: this.pool.getWorstFitness(),
      diversity: this.pool.getDiversityIndex(),
      stagnationCount: this.stagnationCount,
      improvements: 0,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    });
  }

  private injectDiversity(): void {
    const randomGenes = this.pool.getRandomGenes(3);
    for (const gene of randomGenes) {
      const mutated = this.mutator.mutate(gene);
      mutated.fitness = 0;
      this.pool.addGene(mutated);
    }
    logger.info('Injected diversity into gene pool');
  }

  getHistory(): EvolutionResult[] {
    return [...this.history];
  }

  getStagnationCount(): number {
    return this.stagnationCount;
  }

  reset(): void {
    this.stagnationCount = 0;
    this.lastBestFitness = -Infinity;
    this.history = [];
  }
}
