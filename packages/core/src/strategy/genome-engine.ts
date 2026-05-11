import type { Result, EvolutionConfig, FitnessScore, GeneId } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { StrategyGene } from "./gene.js";
import { GenePool } from "./gene-pool.js";
import { FitnessEvaluator } from "./fitness-evaluator.js";
import { EvolutionLoop } from "./evolution/evolution-loop.js";
import { Selector } from "./evolution/selector.js";
import { Mutator } from "./evolution/mutator.js";
import { Crossover } from "./evolution/crossover.js";
import { UserAdaptation } from "./adaptation/user-adaptation.js";
import { DomainAdaptation } from "./adaptation/domain-adaptation.js";
import { ContextAdaptation } from "./adaptation/context-adaptation.js";
import { GeneSerializer } from "./gene-serializer.js";
import { GenePersistence } from "./gene-persistence.js";
import { GeneAnalytics } from "./gene-analytics.js";
import type {
  GenePoolData,
  EvolutionState,
  EvolutionEvent,
  EvolutionEventName,
  EvolutionEventHandler,
  ObjectiveWeights,
  SelectionConfig,
  MutationConfig,
  CrossoverConfig,
  DomainType,
} from "./types.js";
import {
  DEFAULT_EVOLUTION_CONFIG,
  DEFAULT_OBJECTIVE_WEIGHTS,
} from "./types.js";

export interface GenomeEngineConfig {
  evolution?: Partial<EvolutionConfig>;
  selection?: Partial<SelectionConfig>;
  mutation?: Partial<MutationConfig>;
  crossover?: Partial<CrossoverConfig>;
  weights?: Partial<ObjectiveWeights>;
  persistencePath?: string;
}

export class GenomeEngine {
  private config: GenomeEngineConfig;
  private pool: GenePool;
  private evaluator: FitnessEvaluator;
  private evolutionLoop: EvolutionLoop;
  private userAdaptation: UserAdaptation;
  private domainAdaptation: DomainAdaptation;
  private contextAdaptation: ContextAdaptation;
  private serializer: GeneSerializer;
  private persistence: GenePersistence;
  private analytics: GeneAnalytics;
  private eventHandlers: Map<EvolutionEventName, Set<EvolutionEventHandler>>;
  private initialized: boolean;
  private state: EvolutionState;

  constructor(config?: GenomeEngineConfig) {
    this.config = config ?? {};
    this.pool = new GenePool();
    this.evaluator = new FitnessEvaluator(config?.weights);
    this.evolutionLoop = new EvolutionLoop(this.evaluator, {
      evolution: config?.evolution,
      selection: config?.selection,
      mutation: config?.mutation,
      crossover: config?.crossover,
    });
    this.userAdaptation = new UserAdaptation();
    this.domainAdaptation = new DomainAdaptation();
    this.contextAdaptation = new ContextAdaptation(this.domainAdaptation);
    this.serializer = new GeneSerializer();
    this.persistence = new GenePersistence(config?.persistencePath);
    this.analytics = new GeneAnalytics();
    this.eventHandlers = new Map();
    this.initialized = false;
    this.state = this.createInitialState();
  }

  init(config?: GenomeEngineConfig): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (this.config.weights) {
      this.evaluator.setWeights(this.config.weights);
    }

    this.evolutionLoop = new EvolutionLoop(this.evaluator, {
      evolution: this.config.evolution,
      selection: this.config.selection,
      mutation: this.config.mutation,
      crossover: this.config.crossover,
    });

    this.initialized = true;
    this.state = this.createInitialState();

    this.emit({
      type: "engine:initialized",
      timestamp: new Date().toISOString(),
      data: { config: this.config },
    });
  }

  shutdown(): void {
    this.pool.clear();
    this.evaluator.reset();
    this.evolutionLoop.reset();
    this.initialized = false;

    this.emit({
      type: "engine:shutdown",
      timestamp: new Date().toISOString(),
      data: {},
    });

    this.eventHandlers.clear();
  }

  async evolve(pool?: GenePool, config?: Partial<EvolutionConfig>): Promise<Result<import("@paracosm/shared").EvolutionResult, Error>> {
    if (!this.initialized) {
      return err(new Error("GenomeEngine is not initialized. Call init() first."));
    }

    const targetPool = pool ?? this.pool;
    const evolutionConfig = { ...DEFAULT_EVOLUTION_CONFIG, ...this.config.evolution, ...config };

    this.emit({
      type: "evolution:started",
      timestamp: new Date().toISOString(),
      data: { generation: targetPool.getGeneration() },
    });

    try {
      const startTime = Date.now();
      const previousBestFitness = targetPool.stats().maxFitness;

      const evolvedPool = this.evolutionLoop.runGeneration(targetPool, evolutionConfig);

      const stats = evolvedPool.stats();
      const currentBestFitness = stats.maxFitness;

      if (Math.abs(currentBestFitness - previousBestFitness) < (evolutionConfig.stagnationThreshold ?? 0.001)) {
        evolvedPool.incrementStagnation();
      } else {
        evolvedPool.resetStagnation();
      }

      if (evolvedPool.getStagnationCount() >= (evolutionConfig.stagnationThreshold ? 20 : 20)) {
        this.emit({
          type: "evolution:stagnated",
          timestamp: new Date().toISOString(),
          data: {
            generation: evolvedPool.getGeneration(),
            stagnationCount: evolvedPool.getStagnationCount(),
          },
        });
      }

      this.updateState(evolvedPool);

      const topGenes = evolvedPool.getTopGenes(1);
      const result: import("@paracosm/shared").EvolutionResult = {
        generation: evolvedPool.getGeneration(),
        bestGeneId: topGenes.length > 0 ? (topGenes[0].id as unknown as GeneId) : ("" as unknown as GeneId),
        bestFitness: stats.maxFitness,
        averageFitness: stats.averageFitness,
        worstFitness: stats.minFitness,
        diversityIndex: stats.diversityIndex,
        mutationsApplied: this.evolutionLoop.getMutator().getGenerationMutations(),
        crossoversApplied: this.evolutionLoop.getCrossover().getCrossoverCount(),
        genesCreated: 0,
        genesRemoved: 0,
        stagnationDetected: evolvedPool.getStagnationCount() >= 10,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      this.emit({
        type: "evolution:completed",
        timestamp: new Date().toISOString(),
        data: { generation: result.generation, bestFitness: result.bestFitness },
      });

      return ok(result);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  evaluate(gene: StrategyGene, result: { success: boolean; executionTime: number; resourceCost: number; userFeedback: number; constraintViolations: number; goalProgress: number; sideEffects: number }): FitnessScore {
    return this.evaluator.evaluate(gene, result);
  }

  select(n: number, method?: "tournament" | "roulette" | "rank" | "random"): StrategyGene[] {
    if (!this.initialized) {
      throw new Error("GenomeEngine is not initialized");
    }
    return this.pool.select(n, method ?? "tournament");
  }

  getGenome(): GenePool {
    return this.pool;
  }

  importGenome(data: GenePoolData): void {
    const importedPool = this.persistence.dataToPool(data);
    const genes = importedPool.getAllGenes();
    for (const gene of genes) {
      if (!this.pool.has(gene.id as string)) {
        this.pool.add(gene);
      } else {
        this.pool.introduce(gene);
      }
    }
    this.pool.setGeneration(data.generation);
  }

  exportGenome(): GenePoolData {
    return this.persistence.poolToData(this.pool);
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

  getEvaluator(): FitnessEvaluator {
    return this.evaluator;
  }

  getEvolutionLoop(): EvolutionLoop {
    return this.evolutionLoop;
  }

  getUserAdaptation(): UserAdaptation {
    return this.userAdaptation;
  }

  getDomainAdaptation(): DomainAdaptation {
    return this.domainAdaptation;
  }

  getContextAdaptation(): ContextAdaptation {
    return this.contextAdaptation;
  }

  getSerializer(): GeneSerializer {
    return this.serializer;
  }

  getPersistence(): GenePersistence {
    return this.persistence;
  }

  getAnalytics(): GeneAnalytics {
    return this.analytics;
  }

  getState(): EvolutionState {
    return { ...this.state };
  }

  isInitialized(): boolean {
    return this.initialized;
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
    this.state.lastMutationCount = this.evolutionLoop.getMutator().getGenerationMutations();
    this.state.lastCrossoverCount = this.evolutionLoop.getCrossover().getCrossoverCount();
    this.state.totalMutations = this.evolutionLoop.getMutator().getMutationCount();
    this.state.totalCrossovers = this.evolutionLoop.getCrossover().getCrossoverCount();
    this.state.lastUpdateTime = new Date().toISOString();
  }
}
