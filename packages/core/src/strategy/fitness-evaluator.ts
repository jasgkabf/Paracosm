import type { FitnessScore, GeneId } from "@paracosm/shared";
import { StrategyGene } from "./gene.js";
import type { FitnessHistory, ObjectiveWeights, GeneInternal } from "./types.js";
import { DEFAULT_OBJECTIVE_WEIGHTS } from "./types.js";

export interface EvaluationResult {
  success: boolean;
  executionTime: number;
  resourceCost: number;
  userFeedback: number;
  constraintViolations: number;
  goalProgress: number;
  sideEffects: number;
}

export class FitnessEvaluator {
  private fitnessHistory: Map<string, FitnessHistory>;
  private evaluationCounts: Map<string, number>;
  private successCounts: Map<string, number>;
  private totalExecutionTimes: Map<string, number>;
  private totalResourceCosts: Map<string, number>;
  private totalUserFeedback: Map<string, number>;
  private weights: ObjectiveWeights;
  private currentScores: Map<string, FitnessScore>;

  constructor(weights?: Partial<ObjectiveWeights>) {
    this.fitnessHistory = new Map();
    this.evaluationCounts = new Map();
    this.successCounts = new Map();
    this.totalExecutionTimes = new Map();
    this.totalResourceCosts = new Map();
    this.totalUserFeedback = new Map();
    this.weights = { ...DEFAULT_OBJECTIVE_WEIGHTS, ...weights };
    this.currentScores = new Map();
  }

  evaluate(gene: StrategyGene, result: EvaluationResult): FitnessScore {
    const geneId = gene.id as string;
    const effectiveness = this.computeEffectiveness(geneId, result);
    const efficiency = this.computeEfficiency(geneId, result);
    const robustness = this.computeRobustness(geneId, result);
    const novelty = this.computeNovelty(gene);
    const simplicity = this.computeSimplicity(gene);

    const overall =
      effectiveness * this.weights.effectiveness +
      efficiency * this.weights.efficiency +
      robustness * this.weights.robustness +
      novelty * this.weights.novelty +
      simplicity * this.weights.simplicity;

    const evaluations = (this.evaluationCounts.get(geneId) ?? 0) + 1;
    this.evaluationCounts.set(geneId, evaluations);

    if (result.success) {
      this.successCounts.set(geneId, (this.successCounts.get(geneId) ?? 0) + 1);
    }

    this.totalExecutionTimes.set(geneId, (this.totalExecutionTimes.get(geneId) ?? 0) + result.executionTime);
    this.totalResourceCosts.set(geneId, (this.totalResourceCosts.get(geneId) ?? 0) + result.resourceCost);
    this.totalUserFeedback.set(geneId, (this.totalUserFeedback.get(geneId) ?? 0) + result.userFeedback);

    const score: FitnessScore = {
      geneId: geneId as unknown as GeneId,
      overall: clamp(overall, 0, 1),
      effectiveness: clamp(effectiveness, 0, 1),
      efficiency: clamp(efficiency, 0, 1),
      robustness: clamp(robustness, 0, 1),
      novelty: clamp(novelty, 0, 1),
      simplicity: clamp(simplicity, 0, 1),
      evaluations,
      confidence: this.computeConfidence(evaluations),
      lastEvaluated: new Date().toISOString(),
    };

    this.currentScores.set(geneId, score);
    this.recordHistory(geneId, score, gene.generation);
    gene.fitness = score.overall;

    return score;
  }

  multiObjectiveFitness(gene: StrategyGene, objectives: Partial<ObjectiveWeights>): FitnessScore {
    const mergedWeights: ObjectiveWeights = { ...this.weights, ...objectives };
    const geneId = gene.id as string;
    const currentScore = this.currentScores.get(geneId);

    if (!currentScore) {
      return this.evaluate(gene, {
        success: true,
        executionTime: 100,
        resourceCost: 0.5,
        userFeedback: 0.5,
        constraintViolations: 0,
        goalProgress: 0.5,
        sideEffects: 0,
      });
    }

    const overall =
      currentScore.effectiveness * mergedWeights.effectiveness +
      currentScore.efficiency * mergedWeights.efficiency +
      currentScore.robustness * mergedWeights.robustness +
      currentScore.novelty * mergedWeights.novelty +
      currentScore.simplicity * mergedWeights.simplicity;

    const score: FitnessScore = {
      ...currentScore,
      overall: clamp(overall, 0, 1),
    };

    this.currentScores.set(geneId, score);
    this.recordHistory(geneId, score, gene.generation);
    gene.fitness = score.overall;

    return score;
  }

  successRate(geneId: string): number {
    const total = this.evaluationCounts.get(geneId) ?? 0;
    if (total === 0) {
      return 0;
    }
    const successes = this.successCounts.get(geneId) ?? 0;
    return successes / total;
  }

  efficiencyScore(geneId: string): number {
    const total = this.evaluationCounts.get(geneId) ?? 0;
    if (total === 0) {
      return 0.5;
    }
    const totalTime = this.totalExecutionTimes.get(geneId) ?? 0;
    const avgTime = totalTime / total;
    return Math.max(0, Math.min(1, 1 - avgTime / 10000));
  }

  userSatisfactionScore(geneId: string): number {
    const total = this.evaluationCounts.get(geneId) ?? 0;
    if (total === 0) {
      return 0.5;
    }
    const totalFeedback = this.totalUserFeedback.get(geneId) ?? 0;
    return clamp(totalFeedback / total, 0, 1);
  }

  costFitness(geneId: string): number {
    const total = this.evaluationCounts.get(geneId) ?? 0;
    if (total === 0) {
      return 0.5;
    }
    const totalCost = this.totalResourceCosts.get(geneId) ?? 0;
    const avgCost = totalCost / total;
    return Math.max(0, Math.min(1, 1 - avgCost));
  }

  updateFitness(geneId: string, score: FitnessScore): void {
    this.currentScores.set(geneId, score);
    this.recordHistory(geneId, score, 0);
  }

  getFitnessHistory(geneId: string): FitnessHistory {
    const existing = this.fitnessHistory.get(geneId);
    if (existing) {
      return existing;
    }
    return {
      geneId: geneId as unknown as GeneId,
      entries: [],
      trend: "stable",
      averageDelta: 0,
    };
  }

  getCurrentScore(geneId: string): FitnessScore | null {
    return this.currentScores.get(geneId) ?? null;
  }

  setWeights(weights: Partial<ObjectiveWeights>): void {
    this.weights = { ...this.weights, ...weights };
  }

  getWeights(): ObjectiveWeights {
    return { ...this.weights };
  }

  reset(): void {
    this.fitnessHistory.clear();
    this.evaluationCounts.clear();
    this.successCounts.clear();
    this.totalExecutionTimes.clear();
    this.totalResourceCosts.clear();
    this.totalUserFeedback.clear();
    this.currentScores.clear();
  }

  private computeEffectiveness(geneId: string, result: EvaluationResult): number {
    const successComponent = result.success ? 1 : 0;
    const goalComponent = clamp(result.goalProgress, 0, 1);
    const violationPenalty = result.constraintViolations * 0.1;
    const sideEffectPenalty = result.sideEffects * 0.05;
    return clamp((successComponent * 0.5 + goalComponent * 0.5) - violationPenalty - sideEffectPenalty, 0, 1);
  }

  private computeEfficiency(geneId: string, result: EvaluationResult): number {
    const timeScore = Math.max(0, 1 - result.executionTime / 10000);
    const costScore = Math.max(0, 1 - result.resourceCost);
    return clamp(timeScore * 0.5 + costScore * 0.5, 0, 1);
  }

  private computeRobustness(geneId: string, result: EvaluationResult): number {
    const violationRate = result.constraintViolations > 0
      ? Math.min(1, result.constraintViolations / 10)
      : 0;
    const sideEffectRate = result.sideEffects > 0
      ? Math.min(1, result.sideEffects / 10)
      : 0;
    return clamp(1 - violationRate * 0.5 - sideEffectRate * 0.5, 0, 1);
  }

  private computeNovelty(gene: StrategyGene): number {
    const expression = gene.expression;
    const conditionLen = expression.condition.length;
    const actionLen = expression.action.length;
    const lengthNovelty = Math.min(1, (conditionLen + actionLen) / 200);

    const uniqueChars = new Set((expression.condition + expression.action).split("")).size;
    const charNovelty = Math.min(1, uniqueChars / 50);

    const appNovelty = Math.min(1, gene.applicability.length / 10);

    return clamp(lengthNovelty * 0.3 + charNovelty * 0.4 + appNovelty * 0.3, 0, 1);
  }

  private computeSimplicity(gene: StrategyGene): number {
    const expression = gene.expression;
    const conditionComplexity = Math.max(0, 1 - expression.condition.length / 500);
    const actionComplexity = Math.max(0, 1 - expression.action.length / 500);
    const appComplexity = Math.max(0, 1 - gene.applicability.length / 20);
    const constraintComplexity = Math.max(0, 1 - gene.constraints.length / 20);

    return clamp(
      conditionComplexity * 0.3 +
      actionComplexity * 0.3 +
      appComplexity * 0.2 +
      constraintComplexity * 0.2,
      0,
      1
    );
  }

  private computeConfidence(evaluations: number): number {
    if (evaluations <= 0) {
      return 0;
    }
    if (evaluations >= 30) {
      return 1;
    }
    return 1 - Math.exp(-evaluations / 10);
  }

  private recordHistory(geneId: string, score: FitnessScore, generation: number): void {
    const existing = this.fitnessHistory.get(geneId);
    const entry = {
      generation,
      overall: score.overall,
      effectiveness: score.effectiveness,
      efficiency: score.efficiency,
      robustness: score.robustness,
      novelty: score.novelty,
      simplicity: score.simplicity,
      timestamp: new Date().toISOString(),
    };

    if (existing) {
      existing.entries.push(entry);
      if (existing.entries.length > 1000) {
        existing.entries = existing.entries.slice(-500);
      }
      existing.trend = this.computeTrend(existing.entries);
      existing.averageDelta = this.computeAverageDelta(existing.entries);
    } else {
      this.fitnessHistory.set(geneId, {
        geneId: geneId as unknown as GeneId,
        entries: [entry],
        trend: "stable",
        averageDelta: 0,
      });
    }
  }

  private computeTrend(entries: FitnessHistory["entries"]): FitnessHistory["trend"] {
    if (entries.length < 3) {
      return "stable";
    }

    const recent = entries.slice(-10);
    const deltas: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      deltas.push(recent[i].overall - recent[i - 1].overall);
    }

    const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
    const variance = deltas.reduce((sum, d) => sum + Math.pow(d - avgDelta, 2), 0) / deltas.length;

    if (variance > 0.01) {
      return "volatile";
    }
    if (avgDelta > 0.005) {
      return "improving";
    }
    if (avgDelta < -0.005) {
      return "declining";
    }
    return "stable";
  }

  private computeAverageDelta(entries: FitnessHistory["entries"]): number {
    if (entries.length < 2) {
      return 0;
    }
    const recent = entries.slice(-20);
    const deltas: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      deltas.push(recent[i].overall - recent[i - 1].overall);
    }
    return deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
