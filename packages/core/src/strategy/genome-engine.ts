import type { StrategyGene, GeneId, EvolutionConfig, EvolutionResult, AdaptationResult, FitnessScore } from '@paracosm/shared';
import { ok, err, type Result, createLogger } from '@paracosm/shared';
import { GenePool } from './gene-pool.js';
import { FitnessEvaluator } from './fitness-evaluator.js';
import { EvolutionLoop } from './evolution/evolution-loop.js';
import { Mutator } from './evolution/mutator.js';
import { Crossover } from './evolution/crossover.js';
import { UserAdaptation } from './adaptation/user-adaptation.js';
import { DomainAdaptation } from './adaptation/domain-adaptation.js';
import { ContextAdaptation } from './adaptation/context-adaptation.js';
import { GeneSerializer } from './gene-serializer.js';
import { GenePersistence } from './gene-persistence.js';
import { GeneAnalytics } from './gene-analytics.js';
import { createGene, cloneGene } from './gene.js';
import type { StrategyEngineConfig } from './types.js';
import { DEFAULT_STRATEGY_ENGINE_CONFIG } from './types.js';

const logger = createLogger('GenomeEngine');

export class GenomeEngine {
  private config: StrategyEngineConfig;
  private pool: GenePool;
  private evaluator: FitnessEvaluator;
  private mutator: Mutator;
  private crossover: Crossover;
  private userAdaptation: UserAdaptation;
  private domainAdaptation: DomainAdaptation;
  private contextAdaptation: ContextAdaptation;
  private persistence: GenePersistence;
  private analytics: GeneAnalytics;
  private listeners: Map<string, Array<(data: unknown) => void>> = new Map();

  constructor(config: Partial<StrategyEngineConfig> = {}) {
    this.config = { ...DEFAULT_STRATEGY_ENGINE_CONFIG, ...config };
    this.pool = new GenePool(this.config.maxGenePoolSize);
    this.evaluator = new FitnessEvaluator();
    this.mutator = new Mutator(this.config.defaultEvolutionConfig.mutationRate);
    this.crossover = new Crossover(this.config.defaultEvolutionConfig.crossoverRate);
    this.userAdaptation = new UserAdaptation();
    this.domainAdaptation = new DomainAdaptation();
    this.contextAdaptation = new ContextAdaptation();
    this.persistence = new GenePersistence();
    this.analytics = new GeneAnalytics();
  }

  on(event: string, listener: (data: unknown) => void): () => void {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
    return () => {
      const list = this.listeners.get(event);
      if (list) {
        const idx = list.indexOf(listener);
        if (idx !== -1) list.splice(idx, 1);
      }
    };
  }

  private emitEvent(event: string, data: unknown): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) { try { listener(data); } catch (error) { logger.error(`Event listener error: ${error}`); } }
    }
  }

  addGene(data: { name: string; type: string; value: unknown; fitness?: number; parentIds?: GeneId[]; metadata?: Record<string, unknown> }): Result<StrategyGene> {
    const gene = createGene(data);
    const result = this.pool.addGene(gene);
    if (result.ok) this.emitEvent('gene:added', gene);
    return result;
  }

  removeGene(id: GeneId): Result<boolean> {
    const result = this.pool.removeGene(id);
    if (result.ok) this.emitEvent('gene:removed', id);
    return result;
  }

  getGene(id: GeneId): StrategyGene | undefined {
    return this.pool.getGene(id);
  }

  getGenesByType(type: string): StrategyGene[] {
    return this.pool.getGenesByType(type);
  }

  getTopGenes(count: number): StrategyGene[] {
    return this.pool.getTopGenes(count);
  }

  evaluateGene(id: GeneId, functionName?: string): Result<FitnessScore> {
    const gene = this.pool.getGene(id);
    if (!gene) return err(new Error(`Gene ${id} not found`));
    const score = this.evaluator.evaluate(gene, functionName);
    this.pool.updateGene(id, { fitness: score.normalized });
    return ok(score);
  }

  evaluateAll(functionName?: string): FitnessScore[] {
    const genes = this.pool.getAllGenes();
    return this.evaluator.evaluatePopulation(genes, functionName);
  }

  mutateGene(id: GeneId, operatorId?: string): Result<StrategyGene> {
    const gene = this.pool.getGene(id);
    if (!gene) return err(new Error(`Gene ${id} not found`));
    const mutated = this.mutator.mutate(gene, operatorId);
    const result = this.pool.addGene(mutated);
    if (result.ok) this.emitEvent('gene:mutated', { original: id, mutated: mutated.id });
    return result;
  }

  crossoverGenes(idA: GeneId, idB: GeneId, operatorId?: string): Result<[StrategyGene, StrategyGene]> {
    const geneA = this.pool.getGene(idA);
    const geneB = this.pool.getGene(idB);
    if (!geneA) return err(new Error(`Gene ${idA} not found`));
    if (!geneB) return err(new Error(`Gene ${idB} not found`));
    const [childA, childB] = this.crossover.crossover(geneA, geneB, operatorId);
    this.pool.addGene(childA);
    this.pool.addGene(childB);
    this.emitEvent('gene:crossover', { parents: [idA, idB], children: [childA.id, childB.id] });
    return ok([childA, childB]);
  }

  evolve(generations?: number): Result<EvolutionResult> {
    const loop = new EvolutionLoop(this.config.defaultEvolutionConfig, this.pool, this.evaluator);
    const result = loop.run(generations);
    if (result.ok) {
      this.analytics.recordEvolution(result.value);
      this.emitEvent('evolution:completed', result.value);
    }
    return result;
  }

  adaptForUser(geneId: GeneId, userId: string, feedback: number): Result<StrategyGene> {
    if (!this.config.adaptationEnabled) return err(new Error('Adaptation is disabled'));
    const gene = this.pool.getGene(geneId);
    if (!gene) return err(new Error(`Gene ${geneId} not found`));
    const adapted = this.userAdaptation.adapt(gene, userId, feedback);
    this.pool.updateGene(geneId, { fitness: adapted.fitness, metadata: adapted.metadata });
    return ok(adapted);
  }

  adaptForDomain(geneId: GeneId, domain: string): Result<StrategyGene> {
    if (!this.config.adaptationEnabled) return err(new Error('Adaptation is disabled'));
    const gene = this.pool.getGene(geneId);
    if (!gene) return err(new Error(`Gene ${geneId} not found`));
    const adapted = this.domainAdaptation.adapt(gene, domain);
    this.pool.updateGene(geneId, { value: adapted.value, fitness: adapted.fitness, metadata: adapted.metadata });
    return ok(adapted);
  }

  adaptForContext(geneId: GeneId, context: { taskType: string; complexity: 'low' | 'medium' | 'high'; urgency: 'low' | 'medium' | 'high' | 'critical'; resourceConstraints: Record<string, number>; timeConstraints?: number; metadata: Record<string, unknown> }): Result<StrategyGene> {
    if (!this.config.adaptationEnabled) return err(new Error('Adaptation is disabled'));
    const gene = this.pool.getGene(geneId);
    if (!gene) return err(new Error(`Gene ${geneId} not found`));
    const adapted = this.contextAdaptation.adapt(gene, context);
    this.pool.updateGene(geneId, { value: adapted.value, fitness: adapted.fitness, metadata: adapted.metadata });
    return ok(adapted);
  }

  async save(key: string): Promise<Result<boolean>> {
    return this.persistence.save(key, this.pool.getAllGenes());
  }

  async load(key: string): Promise<Result<number>> {
    const result = await this.persistence.load(key);
    if (!result.ok) return err(result.err);
    this.pool.clear();
    for (const gene of result.value) {
      this.pool.addGene(gene);
    }
    return ok(result.value.length);
  }

  getAnalytics(): GeneAnalytics {
    return this.analytics;
  }

  getPool(): GenePool {
    return this.pool;
  }

  getEvaluator(): FitnessEvaluator {
    return this.evaluator;
  }

  getGeneCount(): number {
    return this.pool.getSize();
  }

  getGeneration(): number {
    return this.pool.getGeneration();
  }

  getAverageFitness(): number {
    return this.pool.getAverageFitness();
  }

  getBestFitness(): number {
    return this.pool.getBestFitness();
  }

  clear(): void {
    this.pool.clear();
    this.analytics.clear();
    this.emitEvent('genome:cleared', null);
  }
}
