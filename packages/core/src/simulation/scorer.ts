import type { ScoreWeights, MultiCriteriaResult, TradeoffReport, Tradeoff } from "./types.js";
import { DEFAULT_SCORE_WEIGHTS } from "./types.js";
import { SimulationPath } from "./path.js";

export interface SimulationScoringCriteria {
  dimension: string;
  weight: number;
  evaluate: (path: SimulationPath) => number;
}

export class Scorer {
  private weights: ScoreWeights;
  private customCriteria: Map<string, SimulationScoringCriteria>;

  constructor(weights?: Partial<ScoreWeights>) {
    this.weights = { ...DEFAULT_SCORE_WEIGHTS, ...weights };
    this.customCriteria = new Map();
  }

  scorePath(path: SimulationPath, weights?: ScoreWeights): number {
    const w = weights ?? this.weights;
    return path.evaluate(w);
  }

  scoreOutcome(outcome: string, criteria: Map<string, number>): number {
    const normalizedOutcome = outcome.toLowerCase();
    const scoreMap: Record<string, number> = {
      success: 1.0,
      partial_success: 0.7,
      uncertain: 0.4,
      failure: 0.1,
    };

    const baseScore = scoreMap[normalizedOutcome] ?? 0.5;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [dimension, weight] of criteria) {
      const dimensionModifier = this.getDimensionModifier(dimension, normalizedOutcome);
      weightedSum += baseScore * dimensionModifier * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.max(0, Math.min(1, weightedSum / totalWeight)) : baseScore;
  }

  multiCriteriaScore(path: SimulationPath, criteria: SimulationScoringCriteria[]): MultiCriteriaResult {
    const dimensionScores = new Map<string, number>();
    const dimensionWeights = new Map<string, number>();

    for (const criterion of criteria) {
      const score = criterion.evaluate(path);
      dimensionScores.set(criterion.dimension, score);
      dimensionWeights.set(criterion.dimension, criterion.weight);
    }

    const defaultScores = this.computeDefaultDimensionScores(path);
    for (const [dimension, score] of defaultScores) {
      if (!dimensionScores.has(dimension)) {
        dimensionScores.set(dimension, score);
        dimensionWeights.set(dimension, this.getWeightForDimension(dimension));
      }
    }

    let overallScore = 0;
    let totalWeight = 0;
    for (const [dimension, score] of dimensionScores) {
      const weight = dimensionWeights.get(dimension) ?? 1;
      overallScore += score * weight;
      totalWeight += weight;
    }

    if (totalWeight > 0) {
      overallScore /= totalWeight;
    }

    return {
      overallScore: Math.max(0, Math.min(1, overallScore)),
      dimensionScores,
      dimensionWeights,
      dominatedBy: [],
      dominates: [],
      isParetoOptimal: false,
    };
  }

  weightedScore(scores: Map<string, number>, weights: Map<string, number>): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [dimension, score] of scores) {
      const weight = weights.get(dimension) ?? 1;
      weightedSum += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  paretoOptimal(paths: SimulationPath[]): SimulationPath[] {
    if (paths.length === 0) return [];

    const dimensions = ["feasibility", "efficiency", "risk", "goalAlignment", "constraintSatisfaction", "resourceUtilization"];
    const pathScores = new Map<string, Map<string, number>>();

    for (const path of paths) {
      const scores = this.computeDefaultDimensionScores(path);
      pathScores.set(path.getId(), scores);
    }

    const paretoSet: SimulationPath[] = [];

    for (let i = 0; i < paths.length; i++) {
      const candidateId = paths[i].getId();
      const candidateScores = pathScores.get(candidateId)!;
      let dominated = false;

      for (let j = 0; j < paths.length; j++) {
        if (i === j) continue;

        const otherId = paths[j].getId();
        const otherScores = pathScores.get(otherId)!;

        if (this.dominates(otherScores, candidateScores, dimensions)) {
          dominated = true;
          break;
        }
      }

      if (!dominated) {
        paretoSet.push(paths[i]);
      }
    }

    return paretoSet;
  }

  tradeoffAnalysis(paths: SimulationPath[]): TradeoffReport {
    if (paths.length === 0) {
      return {
        paths: [],
        dimensions: [],
        matrix: new Map(),
        paretoOptimal: [],
        dominated: [],
        tradeoffs: [],
        summary: "No paths to analyze",
      };
    }

    const dimensions = ["feasibility", "efficiency", "risk", "goalAlignment", "constraintSatisfaction", "resourceUtilization"];
    const matrix = new Map<string, Map<string, number>>();
    const pathIds = paths.map((p) => p.getId());

    for (const path of paths) {
      const scores = this.computeDefaultDimensionScores(path);
      matrix.set(path.getId(), scores);
    }

    const paretoOptimalPaths = this.paretoOptimal(paths);
    const paretoOptimalIds = new Set(paretoOptimalPaths.map((p) => p.getId()));
    const dominated = pathIds.filter((id) => !paretoOptimalIds.has(id));

    const tradeoffs = this.computeTradeoffs(paths, matrix, dimensions);

    const summary = this.generateTradeoffSummary(paretoOptimalPaths, dominated, tradeoffs);

    return {
      paths: pathIds,
      dimensions,
      matrix,
      paretoOptimal: Array.from(paretoOptimalIds),
      dominated,
      tradeoffs,
      summary,
    };
  }

  addCriterion(criterion: SimulationScoringCriteria): void {
    this.customCriteria.set(criterion.dimension, criterion);
  }

  removeCriterion(dimension: string): void {
    this.customCriteria.delete(dimension);
  }

  getWeights(): ScoreWeights {
    return { ...this.weights };
  }

  setWeights(weights: Partial<ScoreWeights>): void {
    this.weights = { ...this.weights, ...weights };
  }

  private computeDefaultDimensionScores(path: SimulationPath): Map<string, number> {
    const totalCost = path.getTotalCost();
    const totalRisk = path.getTotalRisk();
    const duration = path.getEstimatedDuration();
    const probability = path.getProbability();
    const nodeCount = path.getNodeCount();

    const feasibility = Math.min(1, nodeCount / 10) * (1 - totalRisk);
    const efficiency = totalCost > 0 ? 1.0 / (1.0 + totalCost) : 1.0;
    const risk = 1.0 - totalRisk;
    const goalAlignment = probability;
    const constraintSatisfaction = 1.0 - totalRisk * 0.8;
    const resourceUtilization = duration > 0 ? 1.0 / (1.0 + duration / 1000) : 1.0;

    return new Map([
      ["feasibility", feasibility],
      ["efficiency", efficiency],
      ["risk", risk],
      ["goalAlignment", goalAlignment],
      ["constraintSatisfaction", constraintSatisfaction],
      ["resourceUtilization", resourceUtilization],
    ]);
  }

  private getWeightForDimension(dimension: string): number {
    const weightMap: Record<string, number> = {
      feasibility: this.weights.feasibility,
      efficiency: this.weights.efficiency,
      risk: this.weights.risk,
      goalAlignment: this.weights.goalAlignment,
      constraintSatisfaction: this.weights.constraintSatisfaction,
      resourceUtilization: this.weights.resourceUtilization,
      novelty: this.weights.novelty,
      robustness: this.weights.robustness,
    };
    return weightMap[dimension] ?? 0.1;
  }

  private getDimensionModifier(dimension: string, outcome: string): number {
    const modifiers: Record<string, Record<string, number>> = {
      feasibility: { success: 1.2, partial_success: 1.0, uncertain: 0.8, failure: 0.4 },
      efficiency: { success: 1.1, partial_success: 0.9, uncertain: 0.7, failure: 0.5 },
      risk: { success: 1.0, partial_success: 0.8, uncertain: 0.6, failure: 0.3 },
      goalAlignment: { success: 1.3, partial_success: 1.0, uncertain: 0.7, failure: 0.2 },
    };

    return modifiers[dimension]?.[outcome] ?? 1.0;
  }

  private dominates(
    a: Map<string, number>,
    b: Map<string, number>,
    dimensions: string[]
  ): boolean {
    let atLeastOneBetter = false;

    for (const dim of dimensions) {
      const aVal = a.get(dim) ?? 0;
      const bVal = b.get(dim) ?? 0;

      if (aVal < bVal) return false;
      if (aVal > bVal) atLeastOneBetter = true;
    }

    return atLeastOneBetter;
  }

  private computeTradeoffs(
    paths: SimulationPath[],
    matrix: Map<string, Map<string, number>>,
    dimensions: string[]
  ): Tradeoff[] {
    const tradeoffs: Tradeoff[] = [];

    if (paths.length < 2) return tradeoffs;

    const paretoPaths = this.paretoOptimal(paths);
    if (paretoPaths.length < 2) return tradeoffs;

    for (let i = 0; i < Math.min(paretoPaths.length, 5); i++) {
      for (let j = i + 1; j < Math.min(paretoPaths.length, 5); j++) {
        const pathA = paretoPaths[i];
        const pathB = paretoPaths[j];
        const scoresA = matrix.get(pathA.getId())!;
        const scoresB = matrix.get(pathB.getId())!;

        for (const dim of dimensions) {
          const valA = scoresA.get(dim) ?? 0;
          const valB = scoresB.get(dim) ?? 0;
          const diff = Math.abs(valA - valB);

          if (diff > 0.1) {
            tradeoffs.push({
              dimension: dim,
              pathAId: pathA.getId(),
              pathBId: pathB.getId(),
              pathAValue: valA,
              pathBValue: valB,
              difference: diff,
            });
          }
        }
      }
    }

    return tradeoffs;
  }

  private generateTradeoffSummary(
    paretoOptimal: SimulationPath[],
    dominated: string[],
    tradeoffs: Tradeoff[]
  ): string {
    const lines: string[] = [];
    lines.push(`Pareto-optimal paths: ${paretoOptimal.length}`);
    lines.push(`Dominated paths: ${dominated.length}`);
    lines.push(`Significant tradeoffs identified: ${tradeoffs.length}`);

    if (tradeoffs.length > 0) {
      const topTradeoffs = tradeoffs
        .sort((a, b) => b.difference - a.difference)
        .slice(0, 3);

      for (const t of topTradeoffs) {
        lines.push(
          `  ${t.dimension}: ${t.pathAId} (${t.pathAValue.toFixed(3)}) vs ${t.pathBId} (${t.pathBValue.toFixed(3)}), diff=${t.difference.toFixed(3)}`
        );
      }
    }

    return lines.join("\n");
  }
}
