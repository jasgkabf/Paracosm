import { GeneType } from "@paracosm/shared";
import type { EvolutionResult } from "@paracosm/shared";
import { GenePool } from "./gene-pool.js";
import { StrategyGene } from "./gene.js";
import type {
  DiversityReport,
  EvolutionTrend,
  TrendData,
  ConvergenceReport,
  GeneId,
} from "./types.js";

export class GeneAnalytics {
  constructor() {}

  analyzeDiversity(pool: GenePool): DiversityReport {
    const genes = pool.getAllGenes();
    if (genes.length === 0) {
      return {
        overallDiversity: 0,
        typeDiversity: 0,
        fitnessDiversity: 0,
        expressionDiversity: 0,
        speciesCount: 0,
        dominantType: null,
        rareTypes: [],
        recommendations: [],
      };
    }

    const typeDiversity = this.computeTypeDiversity(genes);
    const fitnessDiversity = this.computeFitnessDiversity(genes);
    const expressionDiversity = this.computeExpressionDiversity(genes);

    const overallDiversity = typeDiversity * 0.3 + fitnessDiversity * 0.3 + expressionDiversity * 0.4;

    const typeCounts = new Map<string, number>();
    for (const gene of genes) {
      const type = gene.type as string;
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    }

    let dominantType: GeneType | null = null;
    let maxCount = 0;
    for (const [type, count] of typeCounts) {
      if (count > maxCount) {
        maxCount = count;
        dominantType = type as GeneType;
      }
    }

    const rareTypes: GeneType[] = [];
    for (const [type, count] of typeCounts) {
      if (count <= Math.max(1, Math.floor(genes.length * 0.05))) {
        rareTypes.push(type as GeneType);
      }
    }

    const recommendations = this.generateDiversityRecommendations(
      overallDiversity,
      typeDiversity,
      fitnessDiversity,
      expressionDiversity,
      genes.length
    );

    return {
      overallDiversity,
      typeDiversity,
      fitnessDiversity,
      expressionDiversity,
      speciesCount: typeCounts.size,
      dominantType,
      rareTypes,
      recommendations,
    };
  }

  trackEvolution(history: EvolutionResult[]): EvolutionTrend {
    if (history.length === 0) {
      return {
        generation: 0,
        bestFitnessHistory: [],
        averageFitnessHistory: [],
        diversityHistory: [],
        direction: "stable",
        rate: 0,
        predictedNextBest: 0,
      };
    }

    const bestFitnessHistory = history.map((h) => ({
      generation: h.generation,
      value: h.bestFitness,
    }));

    const averageFitnessHistory = history.map((h) => ({
      generation: h.generation,
      value: h.averageFitness,
    }));

    const diversityHistory = history.map((h) => ({
      generation: h.generation,
      value: h.diversityIndex,
    }));

    const recentHistory = history.slice(-20);
    const direction = this.computeDirection(recentHistory);
    const rate = this.computeRate(recentHistory);

    const predictedNextBest = this.predictNextBest(history);

    return {
      generation: history[history.length - 1].generation,
      bestFitnessHistory,
      averageFitnessHistory,
      diversityHistory,
      direction,
      rate,
      predictedNextBest,
    };
  }

  fitnessTrend(geneId: string): TrendData {
    return {
      geneId: geneId as unknown as GeneId,
      dataPoints: [],
      slope: 0,
      intercept: 0,
      r2: 0,
      trend: "stable",
      confidence: 0,
    };
  }

  fitnessTrendWithData(geneId: string, dataPoints: Array<{ generation: number; fitness: number }>): TrendData {
    if (dataPoints.length < 2) {
      return {
        geneId: geneId as unknown as GeneId,
        dataPoints,
        slope: 0,
        intercept: 0,
        r2: 0,
        trend: "stable",
        confidence: 0,
      };
    }

    const regression = this.linearRegression(dataPoints.map((p) => p.generation), dataPoints.map((p) => p.fitness));

    let trend: "improving" | "declining" | "stable" = "stable";
    if (regression.slope > 0.005) {
      trend = "improving";
    } else if (regression.slope < -0.005) {
      trend = "declining";
    }

    const confidence = Math.min(1, dataPoints.length / 30);

    return {
      geneId: geneId as unknown as GeneId,
      dataPoints,
      slope: regression.slope,
      intercept: regression.intercept,
      r2: regression.r2,
      trend,
      confidence,
    };
  }

  convergenceDetection(history: EvolutionResult[]): ConvergenceReport {
    if (history.length < 5) {
      return {
        converged: false,
        generation: history.length > 0 ? history[history.length - 1].generation : 0,
        stagnationGenerations: 0,
        fitnessDelta: 0,
        diversityDelta: 0,
        convergenceCriteria: [],
        recommendation: "Insufficient data for convergence detection",
      };
    }

    const recent = history.slice(-10);
    const criteria: string[] = [];

    const fitnessDeltas: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      fitnessDeltas.push(Math.abs(recent[i].bestFitness - recent[i - 1].bestFitness));
    }
    const avgFitnessDelta = fitnessDeltas.reduce((sum, d) => sum + d, 0) / fitnessDeltas.length;

    if (avgFitnessDelta < 0.001) {
      criteria.push("Fitness improvement has stagnated");
    }

    const diversityDeltas: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      diversityDeltas.push(Math.abs(recent[i].diversityIndex - recent[i - 1].diversityIndex));
    }
    const avgDiversityDelta = diversityDeltas.reduce((sum, d) => sum + d, 0) / diversityDeltas.length;
    const lastDiversity = recent[recent.length - 1].diversityIndex;

    if (lastDiversity < 0.1) {
      criteria.push("Population diversity is critically low");
    }
    if (avgDiversityDelta < 0.001 && lastDiversity < 0.2) {
      criteria.push("Diversity is stable at low levels");
    }

    let stagnationGenerations = 0;
    for (let i = recent.length - 1; i > 0; i--) {
      if (Math.abs(recent[i].bestFitness - recent[i - 1].bestFitness) < 0.001) {
        stagnationGenerations++;
      } else {
        break;
      }
    }

    const converged = criteria.length >= 2;

    let recommendation: string;
    if (converged) {
      if (lastDiversity < 0.1) {
        recommendation = "Population has converged with low diversity. Consider introducing new genetic material or increasing mutation rate.";
      } else {
        recommendation = "Population has converged. Current best fitness may be near optimal for this configuration.";
      }
    } else if (criteria.length === 1) {
      recommendation = "Early signs of convergence detected. Monitor closely and consider adjusting parameters if stagnation continues.";
    } else {
      recommendation = "Population is still evolving. No convergence detected.";
    }

    return {
      converged,
      generation: recent[recent.length - 1].generation,
      stagnationGenerations,
      fitnessDelta: avgFitnessDelta,
      diversityDelta: avgDiversityDelta,
      convergenceCriteria: criteria,
      recommendation,
    };
  }

  private computeTypeDiversity(genes: StrategyGene[]): number {
    if (genes.length === 0) {
      return 0;
    }

    const typeCounts = new Map<string, number>();
    for (const gene of genes) {
      const type = gene.type as string;
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    }

    const total = genes.length;
    let shannonEntropy = 0;
    for (const count of typeCounts.values()) {
      const p = count / total;
      if (p > 0) {
        shannonEntropy -= p * Math.log2(p);
      }
    }

    const maxEntropy = Math.log2(Object.values(GeneType).length);
    if (maxEntropy === 0) {
      return 0;
    }

    return shannonEntropy / maxEntropy;
  }

  private computeFitnessDiversity(genes: StrategyGene[]): number {
    if (genes.length < 2) {
      return 0;
    }

    const fitnessValues = genes.map((g) => g.fitness);
    const mean = fitnessValues.reduce((sum, f) => sum + f, 0) / fitnessValues.length;
    const variance = fitnessValues.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / fitnessValues.length;
    const stdDev = Math.sqrt(variance);

    return Math.min(1, stdDev * 4);
  }

  private computeExpressionDiversity(genes: StrategyGene[]): number {
    if (genes.length < 2) {
      return 0;
    }

    const sampleSize = Math.min(genes.length, 30);
    const sample: StrategyGene[] = [];
    const usedIndices = new Set<number>();

    while (sample.length < sampleSize) {
      const idx = Math.floor(Math.random() * genes.length);
      if (!usedIndices.has(idx)) {
        usedIndices.add(idx);
        sample.push(genes[idx]);
      }
    }

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < sample.length; i++) {
      for (let j = i + 1; j < sample.length; j++) {
        totalSimilarity += sample[i].similarity(sample[j]);
        comparisons++;
      }
    }

    if (comparisons === 0) {
      return 0;
    }

    return 1 - totalSimilarity / comparisons;
  }

  private generateDiversityRecommendations(
    overall: number,
    typeDiversity: number,
    fitnessDiversity: number,
    expressionDiversity: number,
    populationSize: number
  ): string[] {
    const recommendations: string[] = [];

    if (overall < 0.2) {
      recommendations.push("Overall diversity is critically low. Introduce new genetic material immediately.");
    } else if (overall < 0.3) {
      recommendations.push("Overall diversity is below recommended threshold. Consider increasing mutation rate.");
    }

    if (typeDiversity < 0.3) {
      recommendations.push("Type diversity is low. Encourage exploration of different gene types.");
    }

    if (fitnessDiversity < 0.2) {
      recommendations.push("Fitness diversity is low. Population may be stuck in a local optimum.");
    }

    if (expressionDiversity < 0.3) {
      recommendations.push("Expression diversity is low. Increase mutation magnitude or crossover rate.");
    }

    if (populationSize < 50) {
      recommendations.push("Population size is small. Consider increasing population to maintain diversity.");
    }

    if (recommendations.length === 0) {
      recommendations.push("Diversity levels are healthy. Continue with current configuration.");
    }

    return recommendations;
  }

  private computeDirection(history: EvolutionResult[]): "improving" | "declining" | "stable" {
    if (history.length < 3) {
      return "stable";
    }

    const recent = history.slice(-10);
    const deltas: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      deltas.push(recent[i].bestFitness - recent[i - 1].bestFitness);
    }

    const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;

    if (avgDelta > 0.005) {
      return "improving";
    }
    if (avgDelta < -0.005) {
      return "declining";
    }
    return "stable";
  }

  private computeRate(history: EvolutionResult[]): number {
    if (history.length < 2) {
      return 0;
    }

    const recent = history.slice(-20);
    const fitnessValues = recent.map((h) => h.bestFitness);
    const generations = recent.map((h) => h.generation);

    const regression = this.linearRegression(generations, fitnessValues);
    return regression.slope;
  }

  private predictNextBest(history: EvolutionResult[]): number {
    if (history.length < 3) {
      return history.length > 0 ? history[history.length - 1].bestFitness : 0;
    }

    const recent = history.slice(-20);
    const fitnessValues = recent.map((h) => h.bestFitness);
    const generations = recent.map((h) => h.generation);

    const regression = this.linearRegression(generations, fitnessValues);
    const nextGeneration = generations[generations.length - 1] + 1;
    const predicted = regression.slope * nextGeneration + regression.intercept;

    return Math.max(0, Math.min(1, predicted));
  }

  private linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
    const n = x.length;
    if (n < 2) {
      return { slope: 0, intercept: 0, r2: 0 };
    }

    const sumX = x.reduce((s, v) => s + v, 0);
    const sumY = y.reduce((s, v) => s + v, 0);
    const sumXY = x.reduce((s, v, i) => s + v * y[i], 0);
    const sumX2 = x.reduce((s, v) => s + v * v, 0);

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) {
      return { slope: 0, intercept: sumY / n, r2: 0 };
    }

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    const meanY = sumY / n;
    const ssTot = y.reduce((s, v) => s + Math.pow(v - meanY, 2), 0);
    const ssRes = y.reduce((s, v, i) => s + Math.pow(v - (slope * x[i] + intercept), 2), 0);

    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    return { slope, intercept, r2 };
  }
}
