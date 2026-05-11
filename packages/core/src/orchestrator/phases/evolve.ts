import type { EvolutionResultInternal } from "./../types.js";
import { GeneType } from "@paracosm/shared";
import type {
  EvolveResult,
  EvolutionResult,
  EvolutionConfig,
  GeneId,
  StrategyGene,
  GenePool,
  FitnessScore,
  GeneExpression,
  AdaptationResult,
} from "@paracosm/shared";
import { generateId } from "@paracosm/shared";

interface StrategyPoolInternal {
  genes: Map<string, {
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
  }>;
  generation: number;
  speciesCount: number;
  totalFitness: number;
  averageFitness: number;
  diversityIndex: number;
  stagnationCount: number;
}

interface PersonaRegistryInternal {
  personas: Map<string, {
    id: string;
    role: string;
    expertise: string[];
    weight: number;
    adaptationHistory: Array<{
      timestamp: string;
      type: string;
      description: string;
      outcome: "positive" | "negative" | "neutral";
    }>;
  }>;
}

interface RouterInternal {
  rules: Array<{
    id: string;
    condition: string;
    targetModelId: string;
    priority: number;
    enabled: boolean;
    weight: number;
  }>;
  defaultModelId: string;
}

interface PersistenceInternal {
  save: (data: unknown) => Promise<void>;
  load: () => Promise<unknown>;
}

export class EvolvePhase {
  private evolutionHistory: EvolutionResultInternal[];
  private maxHistorySize: number;

  constructor() {
    this.evolutionHistory = [];
    this.maxHistorySize = 100;
  }

  execute(context: {
    reflectResult: {
      performanceScore: number;
      lessonsLearned: string[];
      improvementAreas: string[];
    };
    pool: StrategyPoolInternal | null;
    config: EvolutionConfig | null;
    personaRegistry: PersonaRegistryInternal | null;
    router: RouterInternal | null;
    persistence: PersistenceInternal | null;
  }): EvolveResult {
    const startTime = Date.now();

    let evolutionResult: EvolutionResultInternal | null = null;
    let genesImproved = 0;
    let genesCreated = 0;
    let genesRetired = 0;
    let fitnessImprovement = 0;
    let diversityChange = 0;

    if (context.pool && context.config) {
      const previousAvgFitness = context.pool.averageFitness;
      const previousDiversity = context.pool.diversityIndex;

      evolutionResult = this.triggerEvolution(context.pool, context.config);

      if (evolutionResult) {
        this.updateGenePool(evolutionResult, context.pool);

        genesCreated = evolutionResult.genesCreated;
        genesRetired = evolutionResult.genesRetired;

        fitnessImprovement = context.pool.averageFitness - previousAvgFitness;
        diversityChange = context.pool.diversityIndex - previousDiversity;

        genesImproved = this.countImprovedGenes(context.pool, previousAvgFitness);

        this.evolutionHistory.push(evolutionResult);
        if (this.evolutionHistory.length > this.maxHistorySize) {
          this.evolutionHistory.shift();
        }
      }
    }

    if (context.personaRegistry && context.reflectResult) {
      this.adaptPersonas(
        {
          performanceScore: context.reflectResult.performanceScore,
          improvementAreas: context.reflectResult.improvementAreas,
        },
        context.personaRegistry
      );
    }

    if (context.router && context.reflectResult) {
      this.updateRouting(
        {
          performanceScore: context.reflectResult.performanceScore,
          improvementAreas: context.reflectResult.improvementAreas,
        },
        context.router
      );
    }

    if (context.pool && context.persistence) {
      this.persistChanges(context.pool, context.persistence);
    }

    const sharedEvolutionResult: EvolutionResult | null = evolutionResult && evolutionResult.bestGeneId
      ? {
          generation: evolutionResult.generation,
          bestGeneId: evolutionResult.bestGeneId,
          bestFitness: evolutionResult.bestFitness,
          averageFitness: evolutionResult.averageFitness,
          worstFitness: evolutionResult.worstFitness,
          diversityIndex: evolutionResult.diversityIndex,
          mutationsApplied: evolutionResult.mutationsApplied,
          crossoversApplied: evolutionResult.crossoversApplied,
          genesCreated: evolutionResult.genesCreated,
          genesRemoved: evolutionResult.genesRetired,
          stagnationDetected: evolutionResult.stagnationDetected,
          duration: evolutionResult.duration,
          timestamp: new Date().toISOString(),
        }
      : null;

    return {
      evolutionResult: sharedEvolutionResult,
      genesImproved,
      genesCreated,
      genesRetired,
      fitnessImprovement,
      diversityChange,
      duration: Date.now() - startTime,
    };
  }

  triggerEvolution(
    pool: StrategyPoolInternal,
    config: EvolutionConfig
  ): EvolutionResultInternal {
    const startTime = Date.now();

    const activeGenes = Array.from(pool.genes.values()).filter((g) => g.active);
    if (activeGenes.length === 0) {
      return {
        generation: pool.generation,
        bestGeneId: null,
        bestFitness: 0,
        averageFitness: 0,
        worstFitness: 0,
        diversityIndex: 0,
        mutationsApplied: 0,
        crossoversApplied: 0,
        genesCreated: 0,
        genesRetired: 0,
        stagnationDetected: true,
        duration: Date.now() - startTime,
      };
    }

    const sortedGenes = [...activeGenes].sort((a, b) => b.fitness - a.fitness);
    const bestGene = sortedGenes[0];
    const bestFitness = bestGene.fitness;
    const averageFitness = activeGenes.reduce((sum, g) => sum + g.fitness, 0) / activeGenes.length;

    const diversityIndex = this.calculateDiversity(activeGenes);

    const stagnationDetected = this.detectStagnation(pool, config);

    let mutationsApplied = 0;
    let crossoversApplied = 0;
    let genesCreated = 0;
    let genesRetired = 0;

    const eliteCount = Math.min(config.elitismCount, activeGenes.length);
    const elite = sortedGenes.slice(0, eliteCount);

    const mutationCount = Math.floor(activeGenes.length * config.mutationRate);
    const mutatedGenes = this.performMutations(sortedGenes, mutationCount, pool.generation);
    mutationsApplied = mutatedGenes.length;
    genesCreated += mutatedGenes.length;

    const crossoverCount = Math.floor(activeGenes.length * config.crossoverRate / 2);
    const crossoverGenes = this.performCrossovers(sortedGenes, crossoverCount, pool.generation);
    crossoversApplied = crossoverCount;
    genesCreated += crossoverGenes.length;

    for (const mutatedGene of mutatedGenes) {
      pool.genes.set(mutatedGene.id as string, mutatedGene);
    }
    for (const crossoverGene of crossoverGenes) {
      pool.genes.set(crossoverGene.id as string, crossoverGene);
    }

    const retirementThreshold = averageFitness * 0.3;
    for (const [geneId, gene] of pool.genes) {
      if (gene.active && gene.fitness < retirementThreshold && !elite.some((e) => e.id === gene.id)) {
        gene.active = false;
        genesRetired++;
      }
    }

    if (stagnationDetected) {
      const injectedGenes = this.injectDiversity(pool, config);
      genesCreated += injectedGenes;
    }

    pool.generation++;
    pool.totalFitness = Array.from(pool.genes.values())
      .filter((g) => g.active)
      .reduce((sum, g) => sum + g.fitness, 0);
    pool.averageFitness = pool.totalFitness / Math.max(
      Array.from(pool.genes.values()).filter((g) => g.active).length,
      1
    );
    pool.diversityIndex = this.calculateDiversity(
      Array.from(pool.genes.values()).filter((g) => g.active)
    );

    if (stagnationDetected) {
      pool.stagnationCount++;
    } else {
      pool.stagnationCount = 0;
    }

    return {
      generation: pool.generation,
      bestGeneId: bestGene.id,
      bestFitness,
      averageFitness: pool.averageFitness,
      worstFitness: activeGenes.length > 0
        ? Math.min(...activeGenes.map((g) => g.fitness))
        : 0,
      diversityIndex: pool.diversityIndex,
      mutationsApplied,
      crossoversApplied,
      genesCreated,
      genesRetired,
      stagnationDetected,
      duration: Date.now() - startTime,
    };
  }

  updateGenePool(result: EvolutionResultInternal, pool: StrategyPoolInternal): void {
    pool.generation = result.generation;
    pool.averageFitness = result.averageFitness;
    pool.diversityIndex = result.diversityIndex;

    if (result.stagnationDetected) {
      pool.stagnationCount++;
    } else {
      pool.stagnationCount = Math.max(0, pool.stagnationCount - 1);
    }

    pool.speciesCount = new Set(
      Array.from(pool.genes.values())
        .filter((g) => g.active)
        .map((g) => g.type)
    ).size;
  }

  adaptPersonas(
    learning: { performanceScore: number; improvementAreas: string[] },
    registry: PersonaRegistryInternal
  ): void {
    const timestamp = new Date().toISOString();

    for (const [personaId, persona] of registry.personas) {
      const weightAdjustment = learning.performanceScore > 0.7 ? 0.05 : -0.05;
      persona.weight = Math.max(0.1, Math.min(2.0, persona.weight + weightAdjustment));

      const relevantAreas = learning.improvementAreas.filter((area) =>
        persona.expertise.some((exp) => area.includes(exp) || exp.includes(area))
      );

      if (relevantAreas.length > 0) {
        persona.adaptationHistory.push({
          timestamp,
          type: "weight",
          description: `Adjusted weight by ${weightAdjustment > 0 ? "+" : ""}${weightAdjustment.toFixed(3)} based on performance score ${learning.performanceScore.toFixed(3)}`,
          outcome: weightAdjustment > 0 ? "positive" : "negative",
        });
      }
    }
  }

  updateRouting(
    analysis: { performanceScore: number; improvementAreas: string[] },
    router: RouterInternal
  ): void {
    for (const rule of router.rules) {
      if (!rule.enabled) continue;

      if (analysis.performanceScore < 0.5) {
        rule.weight = Math.max(0.1, rule.weight - 0.1);
      } else if (analysis.performanceScore > 0.8) {
        rule.weight = Math.min(2.0, rule.weight + 0.05);
      }

      if (analysis.improvementAreas.some((area) => rule.condition.toLowerCase().includes(area))) {
        rule.priority = Math.min(10, rule.priority + 1);
      }
    }

    router.rules.sort((a, b) => b.priority - a.priority);
  }

  persistChanges(pool: StrategyPoolInternal, persistence: PersistenceInternal): void {
    const data = {
      generation: pool.generation,
      speciesCount: pool.speciesCount,
      totalFitness: pool.totalFitness,
      averageFitness: pool.averageFitness,
      diversityIndex: pool.diversityIndex,
      stagnationCount: pool.stagnationCount,
      geneCount: pool.genes.size,
      activeGeneCount: Array.from(pool.genes.values()).filter((g) => g.active).length,
      timestamp: new Date().toISOString(),
    };

    persistence.save(data).catch(() => {});
  }

  getEvolutionHistory(): EvolutionResultInternal[] {
    return [...this.evolutionHistory];
  }

  private calculateDiversity(
    genes: Array<{ type: GeneType; fitness: number; expression: GeneExpression }>
  ): number {
    if (genes.length <= 1) return 0;

    const typeCounts: Record<string, number> = {};
    for (const gene of genes) {
      typeCounts[gene.type] = (typeCounts[gene.type] ?? 0) + 1;
    }

    let typeDiversity = 0;
    for (const count of Object.values(typeCounts)) {
      const proportion = count / genes.length;
      typeDiversity -= proportion * Math.log2(proportion + 1e-10);
    }
    typeDiversity = typeDiversity / Math.log2(Object.keys(typeCounts).length + 1e-10);

    const fitnessValues = genes.map((g) => g.fitness);
    const meanFitness = fitnessValues.reduce((sum, f) => sum + f, 0) / fitnessValues.length;
    const fitnessVariance = fitnessValues.reduce((sum, f) => sum + Math.pow(f - meanFitness, 2), 0) / fitnessValues.length;
    const fitnessDiversity = Math.min(fitnessVariance * 4, 1);

    return typeDiversity * 0.6 + fitnessDiversity * 0.4;
  }

  private detectStagnation(pool: StrategyPoolInternal, config: EvolutionConfig): boolean {
    if (pool.stagnationCount >= 5) {
      return true;
    }

    const activeGenes = Array.from(pool.genes.values()).filter((g) => g.active);
    if (activeGenes.length < 2) return false;

    const maxFitness = Math.max(...activeGenes.map((g) => g.fitness));
    const minFitness = Math.min(...activeGenes.map((g) => g.fitness));
    const fitnessRange = maxFitness - minFitness;

    if (fitnessRange < config.stagnationThreshold) {
      return true;
    }

    if (pool.diversityIndex < config.diversityThreshold) {
      return true;
    }

    return false;
  }

  private performMutations(
    genes: Array<{
      id: GeneId;
      name: string;
      type: GeneType;
      description: string;
      expression: GeneExpression;
      fitness: number;
      generation: number;
      applicability: string[];
      constraints: string[];
      targetGoals: string[];
      active: boolean;
    }>,
    count: number,
    currentGeneration: number
  ): Array<{
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
  }> {
    const mutated: Array<{
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
    }> = [];

    const candidates = genes.filter((g) => g.active);
    if (candidates.length === 0) return mutated;

    for (let i = 0; i < count; i++) {
      const parent = candidates[Math.floor(Math.random() * candidates.length)];
      const now = new Date().toISOString();

      const mutatedExpression: GeneExpression = {
        condition: this.mutateString(parent.expression.condition),
        action: this.mutateString(parent.expression.action),
        priority: Math.max(0, Math.min(1, parent.expression.priority + (Math.random() - 0.5) * 0.2)),
        weight: Math.max(0, Math.min(1, parent.expression.weight + (Math.random() - 0.5) * 0.2)),
      };

      mutated.push({
        id: generateId() as GeneId,
        name: `mutated_${parent.name}_${i}`,
        type: parent.type,
        description: `Mutation of ${parent.name}`,
        expression: mutatedExpression,
        fitness: parent.fitness * (0.9 + Math.random() * 0.2),
        generation: currentGeneration + 1,
        parentId: parent.id,
        origin: "mutation",
        active: true,
        applicability: [...parent.applicability],
        constraints: [...parent.constraints],
        targetGoals: [...parent.targetGoals],
        createdAt: now,
        updatedAt: now,
      });
    }

    return mutated;
  }

  private performCrossovers(
    genes: Array<{
      id: GeneId;
      name: string;
      type: GeneType;
      description: string;
      expression: GeneExpression;
      fitness: number;
      generation: number;
      applicability: string[];
      constraints: string[];
      targetGoals: string[];
      active: boolean;
    }>,
    count: number,
    currentGeneration: number
  ): Array<{
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
  }> {
    const offspring: Array<{
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
    }> = [];

    const candidates = genes.filter((g) => g.active);
    if (candidates.length < 2) return offspring;

    for (let i = 0; i < count; i++) {
      const parentA = candidates[Math.floor(Math.random() * candidates.length)];
      let parentB = candidates[Math.floor(Math.random() * candidates.length)];
      while (parentB.id === parentA.id && candidates.length > 1) {
        parentB = candidates[Math.floor(Math.random() * candidates.length)];
      }

      const now = new Date().toISOString();
      const crossoverPoint = Math.random();

      const childExpression: GeneExpression = {
        condition: crossoverPoint < 0.5 ? parentA.expression.condition : parentB.expression.condition,
        action: crossoverPoint < 0.5 ? parentB.expression.action : parentA.expression.action,
        priority: (parentA.expression.priority + parentB.expression.priority) / 2,
        weight: (parentA.expression.weight + parentB.expression.weight) / 2,
      };

      const childFitness = (parentA.fitness + parentB.fitness) / 2 * (0.95 + Math.random() * 0.1);

      offspring.push({
        id: generateId() as GeneId,
        name: `crossover_${parentA.name}_x_${parentB.name}`,
        type: crossoverPoint < 0.5 ? parentA.type : parentB.type,
        description: `Crossover of ${parentA.name} and ${parentB.name}`,
        expression: childExpression,
        fitness: childFitness,
        generation: currentGeneration + 1,
        parentId: parentA.id,
        origin: "crossover",
        active: true,
        applicability: [...new Set([...parentA.applicability, ...parentB.applicability])],
        constraints: [...new Set([...parentA.constraints, ...parentB.constraints])],
        targetGoals: [...new Set([...parentA.targetGoals, ...parentB.targetGoals])],
        createdAt: now,
        updatedAt: now,
      });
    }

    return offspring;
  }

  private injectDiversity(pool: StrategyPoolInternal, config: EvolutionConfig): number {
    const types: GeneType[] = [
      GeneType.Heuristic, GeneType.Rule, GeneType.Pattern,
      GeneType.Policy, GeneType.Procedure,
    ];

    let injected = 0;
    const activeGenes = Array.from(pool.genes.values()).filter((g) => g.active);
    const existingTypes = new Set(activeGenes.map((g) => g.type));

    for (const type of types) {
      if (!existingTypes.has(type)) {
        const now = new Date().toISOString();
        const newGene = {
          id: generateId() as GeneId,
          name: `diversity_inject_${type}_${pool.generation}`,
          type,
          description: `Diversity injection: new ${type} gene`,
          expression: {
            condition: "true",
            action: `default_${type}_action`,
            priority: 0.5,
            weight: 0.5,
          },
          fitness: 0.3 + Math.random() * 0.3,
          generation: pool.generation,
          parentId: null,
          origin: "migration" as const,
          active: true,
          applicability: ["general"],
          constraints: [],
          targetGoals: [],
          createdAt: now,
          updatedAt: now,
        };
        pool.genes.set(newGene.id as string, newGene);
        injected++;
      }
    }

    for (let i = 0; i < Math.min(3, config.migrationCount); i++) {
      const now = new Date().toISOString();
      const randomType = types[Math.floor(Math.random() * types.length)];
      const newGene = {
        id: generateId() as GeneId,
        name: `migration_${randomType}_${pool.generation}_${i}`,
        type: randomType,
        description: `Migrated ${randomType} gene for diversity`,
        expression: {
          condition: `context_type == "${randomType}"`,
          action: `migrated_${randomType}_action`,
          priority: 0.3 + Math.random() * 0.4,
          weight: 0.3 + Math.random() * 0.4,
        },
        fitness: 0.2 + Math.random() * 0.4,
        generation: pool.generation,
        parentId: null,
        origin: "migration" as const,
        active: true,
        applicability: [randomType],
        constraints: [],
        targetGoals: [],
        createdAt: now,
        updatedAt: now,
      };
      pool.genes.set(newGene.id as string, newGene);
      injected++;
    }

    return injected;
  }

  private countImprovedGenes(pool: StrategyPoolInternal, previousAvgFitness: number): number {
    let count = 0;
    for (const [_, gene] of pool.genes) {
      if (gene.active && gene.fitness > previousAvgFitness) {
        count++;
      }
    }
    return count;
  }

  private mutateString(input: string): string {
    const mutations = [
      () => input + "_v2",
      () => input.replace(/_v\d+$/, "") + `_v${Math.floor(Math.random() * 10) + 1}`,
      () => input.length > 10 ? input.substring(0, input.length - 3) + "_mod" : input + "_mod",
    ];

    const selectedMutation = mutations[Math.floor(Math.random() * mutations.length)];
    return selectedMutation();
  }
}
