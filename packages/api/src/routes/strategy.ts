import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createLogger, generateId, generateUUID } from "@paracosm/shared";
import { GeneType } from "@paracosm/shared";
import type { FitnessScore } from "@paracosm/shared";
import { WSManager } from "../websocket/ws-manager.js";

const logger = createLogger("api:routes:strategy");

type GeneOrigin = "initial" | "mutation" | "crossover" | "migration";

interface EvolveBody {
  generations?: number;
  mutationRate?: number;
  crossoverRate?: number;
  selectionPressure?: number;
  targetGoals?: string[];
}

interface StrategyParams {
  id: string;
}

interface StoredGene {
  id: string;
  name: string;
  type: GeneType;
  description: string;
  expression: string;
  fitness: number;
  generation: number;
  parentId: string | null;
  origin: GeneOrigin;
  active: boolean;
  applicability: string[];
  constraints: string[];
  targetGoals: string[];
  createdAt: string;
  updatedAt: string;
}

interface StoredFitness {
  geneId: string;
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

interface EvolutionRun {
  id: string;
  config: Record<string, unknown>;
  results: Array<{
    generation: number;
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
  }>;
  startedAt: string;
  completedAt: string | null;
  status: "running" | "completed" | "failed";
}

const genePool = new Map<string, StoredGene>();
const fitnessScores = new Map<string, StoredFitness>();
const evolutionHistory: EvolutionRun[] = [];
let poolGeneration = 0;

function seedGenePool(): void {
  const geneTypes = [GeneType.Heuristic, GeneType.Rule, GeneType.Pattern, GeneType.Policy, GeneType.Procedure];
  const origins: GeneOrigin[] = ["initial", "mutation", "crossover", "migration"];
  const names = [
    "Greedy Selection", "Random Exploration", "Balanced Approach",
    "Conservative Path", "Aggressive Branch", "Adaptive Threshold",
    "Pruning Strategy", "Diversity Preserver", "Score Optimizer",
    "Risk Mitigator", "Resource Balancer", "Timeline Compressor",
  ];

  for (let i = 0; i < names.length; i++) {
    const id = generateId();
    const fitness = 0.3 + Math.random() * 0.6;
    genePool.set(id, {
      id,
      name: names[i],
      type: geneTypes[i % geneTypes.length],
      description: `${names[i]} strategy gene`,
      expression: `fn(state) => state.score * ${fitness.toFixed(2)}`,
      fitness,
      generation: 0,
      parentId: null,
      origin: "initial",
      active: true,
      applicability: ["simulation", "analysis"],
      constraints: [],
      targetGoals: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    fitnessScores.set(id, {
      geneId: id,
      overall: fitness,
      effectiveness: 0.3 + Math.random() * 0.6,
      efficiency: 0.3 + Math.random() * 0.6,
      robustness: 0.3 + Math.random() * 0.6,
      novelty: 0.3 + Math.random() * 0.6,
      simplicity: 0.3 + Math.random() * 0.6,
      evaluations: Math.floor(Math.random() * 100),
      confidence: 0.5 + Math.random() * 0.5,
      lastEvaluated: new Date().toISOString(),
    });
  }

  poolGeneration = 0;
}

seedGenePool();

export async function registerStrategyRoutes(fastify: FastifyInstance, wsManager: WSManager): Promise<void> {
  fastify.get("/strategy/list", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const genes = Array.from(genePool.values());

    return reply.status(200).send({
      success: true,
      data: {
        items: genes,
        generation: poolGeneration,
        speciesCount: new Set(genes.map((g) => g.type)).size,
        averageFitness: genes.reduce((sum, g) => sum + g.fitness, 0) / genes.length,
        diversityIndex: 0.5 + Math.random() * 0.4,
        total: genes.length,
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.get<{ Params: StrategyParams }>("/strategy/:id", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Params: StrategyParams }>, reply: FastifyReply) => {
    const { id } = request.params;

    const gene = genePool.get(id);
    if (!gene) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Strategy gene ${id} not found`, details: { geneId: id } },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    const fitness = fitnessScores.get(id);

    return reply.status(200).send({
      success: true,
      data: { gene, fitness: fitness ?? null },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.post<{ Body: EvolveBody }>("/strategy/evolve", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: EvolveBody }>, reply: FastifyReply) => {
    const {
      generations = 10,
      mutationRate = 0.1,
      crossoverRate = 0.7,
      selectionPressure = 0.5,
      targetGoals = [],
    } = request.body ?? {};

    if (generations < 1 || generations > 1000) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_REQUEST", message: "Generations must be between 1 and 1000", details: { field: "generations", value: generations } },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    const evolutionId = generateUUID();
    const startTime = Date.now();

    const evoRun: EvolutionRun = {
      id: evolutionId,
      config: { generations, mutationRate, crossoverRate, selectionPressure, targetGoals },
      results: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "running",
    };

    evolutionHistory.push(evoRun);

    wsManager.broadcast("strategy/evolved", {
      evolutionId,
      status: "started",
      config: { generations, mutationRate, crossoverRate },
    });

    const results: EvolutionRun["results"] = [];

    for (let gen = 0; gen < generations; gen++) {
      const prevGenGenes = Array.from(genePool.values());
      const prevAvgFitness = prevGenGenes.reduce((sum, g) => sum + g.fitness, 0) / prevGenGenes.length;
      const prevBestFitness = Math.max(...prevGenGenes.map((g) => g.fitness));
      const prevWorstFitness = Math.min(...prevGenGenes.map((g) => g.fitness));

      const mutationsApplied = Math.floor(prevGenGenes.length * mutationRate);
      const crossoversApplied = Math.floor(prevGenGenes.length * crossoverRate * 0.5);
      const genesCreated = mutationsApplied + crossoversApplied;
      const genesRemoved = Math.floor(genesCreated * 0.3);

      const improvement = 0.01 + Math.random() * 0.05;
      const newBestFitness = Math.min(1, prevBestFitness + improvement * (Math.random() > 0.3 ? 1 : -0.5));
      const newAvgFitness = prevAvgFitness + improvement * 0.5 * (Math.random() > 0.4 ? 1 : -0.3);
      const diversityIndex = 0.4 + Math.random() * 0.5;

      for (let m = 0; m < mutationsApplied; m++) {
        const parentGene = prevGenGenes[Math.floor(Math.random() * prevGenGenes.length)];
        const newId = generateId();
        const mutatedFitness = Math.min(1, Math.max(0, parentGene.fitness + (Math.random() - 0.4) * 0.2));

        genePool.set(newId, {
          id: newId,
          name: `${parentGene.name} v${poolGeneration + 1}.${m}`,
          type: parentGene.type,
          description: `Mutated from ${parentGene.name}`,
          expression: parentGene.expression,
          fitness: mutatedFitness,
          generation: poolGeneration + 1,
          parentId: parentGene.id,
          origin: "mutation",
          active: true,
          applicability: parentGene.applicability,
          constraints: parentGene.constraints,
          targetGoals: parentGene.targetGoals,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        fitnessScores.set(newId, {
          geneId: newId,
          overall: mutatedFitness,
          effectiveness: 0.3 + Math.random() * 0.6,
          efficiency: 0.3 + Math.random() * 0.6,
          robustness: 0.3 + Math.random() * 0.6,
          novelty: 0.3 + Math.random() * 0.6,
          simplicity: 0.3 + Math.random() * 0.6,
          evaluations: 1,
          confidence: 0.3,
          lastEvaluated: new Date().toISOString(),
        });
      }

      poolGeneration++;

      const result = {
        generation: gen + 1,
        bestFitness: newBestFitness,
        averageFitness: newAvgFitness,
        worstFitness: prevWorstFitness,
        diversityIndex,
        mutationsApplied,
        crossoversApplied,
        genesCreated,
        genesRemoved,
        stagnationDetected: newBestFitness <= prevBestFitness,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      results.push(result);

      wsManager.broadcast("strategy/evolved", {
        evolutionId,
        status: "progress",
        generation: gen + 1,
        totalGenerations: generations,
        bestFitness: newBestFitness,
        averageFitness: newAvgFitness,
        diversityIndex,
      });
    }

    evoRun.results = results;
    evoRun.completedAt = new Date().toISOString();
    evoRun.status = "completed";

    const duration = Date.now() - startTime;
    const bestResult = results[results.length - 1];

    logger.info("Strategy evolution completed", { evolutionId, generations, duration });

    return reply.status(200).send({
      success: true,
      data: {
        evolutionId,
        generations: results.length,
        bestFitness: bestResult?.bestFitness ?? 0,
        averageFitness: bestResult?.averageFitness ?? 0,
        diversityIndex: bestResult?.diversityIndex ?? 0,
        results,
        duration,
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString(), duration },
    });
  });

  fastify.get("/strategy/analytics", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const genes = Array.from(genePool.values());
    const allFitness = Array.from(fitnessScores.values());
    const fitnessValues = allFitness.map((f) => f.overall);

    const avgFitness = fitnessValues.length > 0
      ? fitnessValues.reduce((sum, f) => sum + f, 0) / fitnessValues.length
      : 0;
    const maxFitness = fitnessValues.length > 0 ? Math.max(...fitnessValues) : 0;
    const minFitness = fitnessValues.length > 0 ? Math.min(...fitnessValues) : 0;

    const completedEvolutions = evolutionHistory.filter((e) => e.status === "completed");

    const genesByType: Record<string, number> = {};
    for (const gene of genes) {
      genesByType[gene.type] = (genesByType[gene.type] ?? 0) + 1;
    }

    const genesByOrigin: Record<string, number> = {};
    for (const gene of genes) {
      genesByOrigin[gene.origin] = (genesByOrigin[gene.origin] ?? 0) + 1;
    }

    return reply.status(200).send({
      success: true,
      data: {
        pool: {
          generation: poolGeneration,
          speciesCount: new Set(genes.map((g) => g.type)).size,
          averageFitness: avgFitness,
          diversityIndex: 0.5 + Math.random() * 0.4,
          totalGenes: genePool.size,
        },
        fitness: {
          average: avgFitness,
          max: maxFitness,
          min: minFitness,
          distribution: {
            top10: fitnessValues.filter((f) => f >= maxFitness * 0.9).length,
            top25: fitnessValues.filter((f) => f >= maxFitness * 0.75).length,
            top50: fitnessValues.filter((f) => f >= maxFitness * 0.5).length,
            bottom50: fitnessValues.filter((f) => f < maxFitness * 0.5).length,
          },
        },
        composition: { byType: genesByType, byOrigin: genesByOrigin },
        evolution: {
          total: evolutionHistory.length,
          completed: completedEvolutions.length,
          failed: evolutionHistory.filter((e) => e.status === "failed").length,
          running: evolutionHistory.filter((e) => e.status === "running").length,
        },
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });
}
