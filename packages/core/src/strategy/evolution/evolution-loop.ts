import type { EvolutionConfig, EvolutionResult } from "@paracosm/shared";
import { StrategyGene } from "../gene.js";
import { GenePool } from "../gene-pool.js";
import { FitnessEvaluator } from "../fitness-evaluator.js";
import { Selector } from "./selector.js";
import { Mutator } from "./mutator.js";
import { Crossover } from "./crossover.js";
import type {
  EvolutionState,
  EvolutionEvent,
  EvolutionEventName,
  EvolutionEventHandler,
  SelectionConfig,
  MutationConfig,
  CrossoverConfig,
} from "../types.js";
import {
  DEFAULT_EVOLUTION_CONFIG,
  DEFAULT_SELECTION_CONFIG,
  DEFAULT_MUTATION_CONFIG,
  DEFAULT_CROSSOVER_CONFIG,
} from "../types.js";

export interface EvolutionLoopConfig {
  evolution: Partial<EvolutionConfig>;
  selection: Partial<SelectionConfig>;
  mutation: Partial<MutationConfig>;
  crossover: Partial<CrossoverConfig>;
}

export class EvolutionLoop {
  private state: EvolutionState;
  private selector: Selector;
  private mutator: Mutator;
  private crossover: Crossover;
  private evaluator: FitnessEvaluator;
  private eventHandlers: Map<EvolutionEventName, Set<EvolutionEventHandler>>;
  private history: EvolutionResult[];

  constructor(evaluator: FitnessEvaluator, config?: Partial<EvolutionLoopConfig>) {
    this.evaluator = evaluator;
    this.selector = new Selector(config?.selection);
    this.mutator = new Mutator(config?.mutation);
    this.crossover = new Crossover(config?.crossover);
    this.eventHandlers = new Map();
    this.history = [];
    this.state = this.createInitialState();
  }

  runGeneration(pool: GenePool, config?: Partial<EvolutionConfig>): GenePool {
    const evolutionConfig: EvolutionConfig = {
      ...DEFAULT_EVOLUTION_CONFIG,
      ...config,
    };

    const generation = pool.getGeneration();
    const startTime = Date.now();

    this.emit({
      type: "evolution:generation",
      timestamp: new Date().toISOString(),
      data: { generation },
    });

    this.evaluatePopulation(pool);

    const elite = this.selector.elitePreserve(pool, evolutionConfig.elitismCount);

    const diversityMaintained = this.selector.diversityMaintain(pool, evolutionConfig.diversityThreshold);

    const parentPairs = this.selectParents(pool, evolutionConfig);
    const offspring = this.produceOffspring(parentPairs, generation, evolutionConfig.maxGenerations);

    this.updatePopulation(pool, offspring);

    for (const gene of elite) {
      if (!pool.has(gene.id as string)) {
        pool.introduce(gene);
      }
    }

    for (const gene of diversityMaintained) {
      if (!pool.has(gene.id as string)) {
        pool.introduce(gene);
      }
    }

    if (pool.getSize() > evolutionConfig.populationSize) {
      pool.prune(evolutionConfig.populationSize);
    }

    pool.setGeneration(generation + 1);

    const stats = pool.stats();
    const result: EvolutionResult = {
      generation,
      bestGeneId: elite.length > 0 ? (elite[0].id as unknown as import("@paracosm/shared").GeneId) : ("" as unknown as import("@paracosm/shared").GeneId),
      bestFitness: stats.maxFitness,
      averageFitness: stats.averageFitness,
      worstFitness: stats.minFitness,
      diversityIndex: stats.diversityIndex,
      mutationsApplied: this.mutator.getGenerationMutations(),
      crossoversApplied: this.crossover.getCrossoverCount(),
      genesCreated: offspring.length,
      genesRemoved: 0,
      stagnationDetected: false,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    this.history.push(result);
    this.mutator.resetGenerationCount();

    this.updateState(pool);

    if (this.checkConvergence(this.history)) {
      this.emit({
        type: "evolution:converged",
        timestamp: new Date().toISOString(),
        data: { generation, bestFitness: stats.maxFitness },
      });
    }

    return pool;
  }

  evaluatePopulation(pool: GenePool): void {
    const genes = pool.getActiveGenes();
    for (const gene of genes) {
      const currentScore = this.evaluator.getCurrentScore(gene.id as string);
      if (!currentScore) {
        this.evaluator.evaluate(gene, {
          success: gene.fitness > 0.5,
          executionTime: (1 - gene.fitness) * 1000,
          resourceCost: (1 - gene.fitness) * 0.5,
          userFeedback: gene.fitness,
          constraintViolations: gene.constraints.length > 5 ? 1 : 0,
          goalProgress: gene.fitness,
          sideEffects: Math.max(0, 3 - Math.floor(gene.fitness * 5)),
        });
      }
    }
  }

  selectParents(pool: GenePool, config: EvolutionConfig): StrategyGene[][] {
    const offspringCount = Math.floor(config.populationSize * config.crossoverRate);
    const pairCount = Math.ceil(offspringCount / 2);
    return this.selector.selectParents(pool, pairCount);
  }

  produceOffspring(parents: StrategyGene[][], generation: number, totalGenerations: number): StrategyGene[] {
    const offspring: StrategyGene[] = [];

    for (const [parentA, parentB] of parents) {
      const children = this.crossover.performCrossover(parentA, parentB);

      for (const child of children) {
        const mutated = this.mutator.applyMutations(child, generation, totalGenerations);
        if (mutated.validate()) {
          offspring.push(mutated);
        }
      }
    }

    return offspring;
  }

  updatePopulation(pool: GenePool, offspring: StrategyGene[]): void {
    for (const gene of offspring) {
      pool.introduce(gene);
    }
  }

  checkConvergence(history: EvolutionResult[]): boolean {
    if (history.length < 5) {
      return false;
    }

    const recent = history.slice(-5);
    const fitnessDeltas: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      fitnessDeltas.push(Math.abs(recent[i].bestFitness - recent[i - 1].bestFitness));
    }

    const avgDelta = fitnessDeltas.reduce((sum, d) => sum + d, 0) / fitnessDeltas.length;
    if (avgDelta < 0.001) {
      return true;
    }

    const diversityDeltas: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      diversityDeltas.push(Math.abs(recent[i].diversityIndex - recent[i - 1].diversityIndex));
    }

    const avgDiversityDelta = diversityDeltas.reduce((sum, d) => sum + d, 0) / diversityDeltas.length;
    if (avgDiversityDelta < 0.001 && recent[recent.length - 1].diversityIndex < 0.1) {
      return true;
    }

    return false;
  }

  getState(): EvolutionState {
    return { ...this.state };
  }

  getHistory(): EvolutionResult[] {
    return [...this.history];
  }

  getSelector(): Selector {
    return this.selector;
  }

  getMutator(): Mutator {
    return this.mutator;
  }

  getCrossover(): Crossover {
    return this.crossover;
  }

  reset(): void {
    this.state = this.createInitialState();
    this.history = [];
    this.mutator.resetGenerationCount();
  }

  on(event: EvolutionEventName, handler: EvolutionEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: EvolutionEventName, handler: EvolutionEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: EvolutionEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch {
          // swallow handler errors
        }
      }
    }
  }

  private createInitialState(): EvolutionState {
    return {
      generation: 0,
      bestFitness: 0,
      averageFitness: 0,
      worstFitness: 0,
      diversityIndex: 0,
      stagnationCount: 0,
      lastMutationCount: 0,
      lastCrossoverCount: 0,
      totalMutations: 0,
      totalCrossovers: 0,
      startTime: new Date().toISOString(),
      lastUpdateTime: new Date().toISOString(),
    };
  }

  private updateState(pool: GenePool): void {
    const stats = pool.stats();
    this.state.generation = pool.getGeneration();
    this.state.bestFitness = stats.maxFitness;
    this.state.averageFitness = stats.averageFitness;
    this.state.worstFitness = stats.minFitness;
    this.state.diversityIndex = stats.diversityIndex;
    this.state.stagnationCount = pool.getStagnationCount();
    this.state.lastMutationCount = this.mutator.getGenerationMutations();
    this.state.lastCrossoverCount = this.crossover.getCrossoverCount();
    this.state.totalMutations = this.mutator.getMutationCount();
    this.state.totalCrossovers = this.crossover.getCrossoverCount();
    this.state.lastUpdateTime = new Date().toISOString();
  }
}
