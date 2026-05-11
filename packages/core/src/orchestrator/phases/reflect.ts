import type { Comparison, DeviationAnalysis } from "./../types.js";
import { GoalState, ConstraintStatus } from "@paracosm/shared";
import type {
  ReflectResult,
  ExecuteResult,
  SimulateResult,
  ConstructResult,
  WorldModelState,
  DebateResult,
  GoalId,
  GeneId,
  FitnessScore,
} from "@paracosm/shared";
import { generateId } from "@paracosm/shared";

interface StrategyPool {
  genes: Map<string, { id: GeneId; fitness: number; generation: number; active: boolean }>;
  generation: number;
  averageFitness: number;
  diversityIndex: number;
}

interface LearningEntry {
  timestamp: string;
  category: string;
  lesson: string;
  applicability: string[];
  confidence: number;
}

export class ReflectPhase {
  private learningHistory: LearningEntry[];
  private maxHistorySize: number;

  constructor() {
    this.learningHistory = [];
    this.maxHistorySize = 1000;
  }

  execute(context: {
    expected: SimulateResult;
    actual: ExecuteResult;
    constructResult: ConstructResult;
    worldModel: WorldModelState;
  }): ReflectResult {
    const startTime = Date.now();
    const { expected, actual, constructResult, worldModel } = context;

    const comparison = this.compareExpected(expected, actual);
    const deviation = this.analyzeDeviation(comparison);

    const lessonsLearned = this.extractLessons(comparison, deviation, actual);
    const performanceScore = this.calculatePerformanceScore(actual, comparison);
    const improvementAreas = this.identifyImprovementAreas(deviation, actual);
    const strengths = this.identifyStrengths(actual, comparison);
    const recommendations = this.generateRecommendations(improvementAreas, deviation);

    this.learnFromResult({ lessonsLearned, performanceScore, improvementAreas }, null);

    this.updateWorldModelPostReflection(deviation, worldModel);

    let debateResult: DebateResult | null = null;

    return {
      debateResult,
      lessonsLearned,
      performanceScore,
      improvementAreas,
      strengths,
      recommendations,
      duration: Date.now() - startTime,
    };
  }

  compareExpected(expected: SimulateResult, actual: ExecuteResult): Comparison {
    const deviations: Comparison["deviations"] = [];

    const expectedSuccessRate = expected.simulations.length > 0 && expected.bestPath
      ? expected.bestPath.score.overall
      : 0.5;

    const successRateDiff = Math.abs(expectedSuccessRate - actual.successRate);
    if (successRateDiff > 0.1) {
      deviations.push({
        field: "successRate",
        expected: expectedSuccessRate,
        actual: actual.successRate,
        severity: successRateDiff > 0.3 ? "high" : successRateDiff > 0.15 ? "medium" : "low",
      });
    }

    const expectedActions = expected.bestPath?.insights.length ?? 0;
    const actualActions = actual.actionsTaken.length;
    const actionCountDiff = Math.abs(expectedActions - actualActions);
    if (actionCountDiff > 2) {
      deviations.push({
        field: "actionCount",
        expected: expectedActions,
        actual: actualActions,
        severity: actionCountDiff > 5 ? "high" : "medium",
      });
    }

    if (actual.unexpectedEvents.length > 0) {
      deviations.push({
        field: "unexpectedEvents",
        expected: 0,
        actual: actual.unexpectedEvents.length,
        severity: actual.unexpectedEvents.length > 3 ? "high" : actual.unexpectedEvents.length > 1 ? "medium" : "low",
      });
    }

    if (actual.adaptationsRequired > 0) {
      deviations.push({
        field: "adaptationsRequired",
        expected: 0,
        actual: actual.adaptationsRequired,
        severity: actual.adaptationsRequired > 3 ? "high" : "medium",
      });
    }

    const matchScore = this.calculateMatchScore(deviations);

    let overallAssessment: Comparison["overallAssessment"];
    if (matchScore >= 0.9) overallAssessment = "excellent";
    else if (matchScore >= 0.75) overallAssessment = "good";
    else if (matchScore >= 0.6) overallAssessment = "acceptable";
    else if (matchScore >= 0.4) overallAssessment = "poor";
    else overallAssessment = "critical";

    return {
      matchScore,
      deviations,
      overallAssessment,
    };
  }

  analyzeDeviation(comparison: Comparison): DeviationAnalysis {
    const totalDeviations = comparison.deviations.length;
    const criticalDeviations = comparison.deviations.filter(
      (d) => d.severity === "high"
    ).length;

    const deviationCategories: Record<string, number> = {};
    for (const deviation of comparison.deviations) {
      const category = this.categorizeDeviation(deviation.field);
      deviationCategories[category] = (deviationCategories[category] ?? 0) + 1;
    }

    const rootCauses = this.identifyRootCauses(comparison.deviations);
    const impactAssessment = this.assessImpact(comparison);
    const correctiveActions = this.suggestCorrectiveActions(comparison.deviations);

    return {
      totalDeviations,
      criticalDeviations,
      deviationCategories,
      rootCauses,
      impactAssessment,
      correctiveActions,
    };
  }

  learnFromResult(
    result: { lessonsLearned: string[]; performanceScore: number; improvementAreas: string[] },
    strategyPool: StrategyPool | null
  ): void {
    const timestamp = new Date().toISOString();

    for (const lesson of result.lessonsLearned) {
      const entry: LearningEntry = {
        timestamp,
        category: this.categorizeLesson(lesson),
        lesson,
        applicability: result.improvementAreas,
        confidence: result.performanceScore,
      };

      this.learningHistory.push(entry);
      if (this.learningHistory.length > this.maxHistorySize) {
        this.learningHistory.shift();
      }
    }

    if (strategyPool) {
      this.updateStrategyPoolFromLearning(result, strategyPool);
    }
  }

  updateWorldModel(analysis: DeviationAnalysis, worldModel: WorldModelState): void {
    for (const deviation of Object.entries(analysis.deviationCategories)) {
      const [category, count] = deviation;
      if (count > 2) {
        const constraintId = generateId();
        worldModel.constraintMap.constraints.set(constraintId as any, {
          id: constraintId as any,
          name: `Reflection constraint: ${category}`,
          type: "soft" as any,
          status: "active" as any,
          description: `Constraint added due to repeated deviations in ${category}`,
          expression: `deviation_count("${category}") <= 2`,
          priority: 3,
          penalty: count * 2,
          scope: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    worldModel.version++;
    worldModel.checksum = generateId();
  }

  updateFitness(geneId: GeneId, score: number): FitnessScore {
    return {
      geneId,
      overall: score,
      effectiveness: score * 0.9,
      efficiency: score * 0.85,
      robustness: score * 0.8,
      novelty: score * 0.5,
      simplicity: score * 0.7,
      evaluations: 1,
      confidence: 0.6,
      lastEvaluated: new Date().toISOString(),
    };
  }

  getLearningHistory(category?: string): LearningEntry[] {
    if (category) {
      return this.learningHistory.filter((entry) => entry.category === category);
    }
    return [...this.learningHistory];
  }

  private calculateMatchScore(deviations: Comparison["deviations"]): number {
    if (deviations.length === 0) return 1;

    let penalty = 0;
    for (const deviation of deviations) {
      switch (deviation.severity) {
        case "high":
          penalty += 0.2;
          break;
        case "medium":
          penalty += 0.1;
          break;
        case "low":
          penalty += 0.05;
          break;
      }
    }

    return Math.max(0, 1 - penalty);
  }

  private categorizeDeviation(field: string): string {
    if (field.includes("success") || field.includes("Rate")) return "performance";
    if (field.includes("action") || field.includes("Count")) return "execution";
    if (field.includes("unexpected") || field.includes("Event")) return "predictability";
    if (field.includes("adaptation") || field.includes("Required")) return "adaptability";
    return "general";
  }

  private identifyRootCauses(deviations: Comparison["deviations"]): string[] {
    const rootCauses: string[] = [];

    const hasPerformanceIssue = deviations.some(
      (d) => d.field === "successRate" && d.severity !== "low"
    );
    if (hasPerformanceIssue) {
      rootCauses.push("Simulation model may not accurately predict execution outcomes");
    }

    const hasUnexpectedEvents = deviations.some(
      (d) => d.field === "unexpectedEvents"
    );
    if (hasUnexpectedEvents) {
      rootCauses.push("Environmental factors not accounted for in simulation");
    }

    const hasAdaptationIssues = deviations.some(
      (d) => d.field === "adaptationsRequired" && d.severity !== "low"
    );
    if (hasAdaptationIssues) {
      rootCauses.push("Plan rigidity - insufficient flexibility for real-world conditions");
    }

    if (rootCauses.length === 0 && deviations.length > 0) {
      rootCauses.push("Minor discrepancies between simulation and execution");
    }

    return rootCauses;
  }

  private assessImpact(comparison: Comparison): string {
    const criticalCount = comparison.deviations.filter((d) => d.severity === "high").length;
    const mediumCount = comparison.deviations.filter((d) => d.severity === "medium").length;

    if (criticalCount >= 2) {
      return "High impact: Multiple critical deviations indicate significant execution problems";
    }
    if (criticalCount === 1) {
      return "Moderate-high impact: One critical deviation requires immediate attention";
    }
    if (mediumCount >= 2) {
      return "Moderate impact: Several medium-severity deviations suggest room for improvement";
    }
    if (comparison.deviations.length > 0) {
      return "Low impact: Minor deviations within acceptable tolerance";
    }
    return "No impact: Execution matched simulation expectations";
  }

  private suggestCorrectiveActions(deviations: Comparison["deviations"]): string[] {
    const actions: string[] = [];

    for (const deviation of deviations) {
      switch (deviation.field) {
        case "successRate":
          actions.push("Improve simulation accuracy by incorporating more execution feedback");
          actions.push("Add safety margins to simulation predictions");
          break;
        case "unexpectedEvents":
          actions.push("Enhance environment modeling to capture more edge cases");
          actions.push("Implement more robust error handling");
          break;
        case "adaptationsRequired":
          actions.push("Increase plan flexibility with more alternative paths");
          actions.push("Reduce plan granularity to allow for local adaptations");
          break;
        case "actionCount":
          actions.push("Better estimate the number of required actions in simulation");
          break;
      }
    }

    if (actions.length === 0) {
      actions.push("Continue monitoring for deviations in future iterations");
    }

    return actions;
  }

  private extractLessons(
    comparison: Comparison,
    deviation: DeviationAnalysis,
    actual: ExecuteResult
  ): string[] {
    const lessons: string[] = [];

    if (comparison.overallAssessment === "excellent" || comparison.overallAssessment === "good") {
      lessons.push("Execution closely matched simulation predictions");
    }

    if (actual.successRate < 0.5) {
      lessons.push("Low success rate indicates need for better planning or more robust execution");
    }

    if (deviation.criticalDeviations > 0) {
      lessons.push(`Critical deviations detected in ${deviation.criticalDeviations} area(s) - root cause analysis needed`);
    }

    for (const event of actual.unexpectedEvents) {
      lessons.push(`Unexpected event: ${event}`);
    }

    if (actual.adaptationsRequired > 2) {
      lessons.push("High adaptation count suggests plan was not well-suited to actual conditions");
    }

    if (actual.successRate > 0.8) {
      lessons.push("High success rate validates the current approach");
    }

    return lessons;
  }

  private calculatePerformanceScore(actual: ExecuteResult, comparison: Comparison): number {
    let score = actual.successRate * 0.4;
    score += comparison.matchScore * 0.3;
    score += Math.max(0, 1 - actual.unexpectedEvents.length * 0.1) * 0.15;
    score += Math.max(0, 1 - actual.adaptationsRequired * 0.1) * 0.15;

    return Math.min(Math.max(score, 0), 1);
  }

  private identifyImprovementAreas(deviation: DeviationAnalysis, actual: ExecuteResult): string[] {
    const areas: string[] = [];

    if (actual.successRate < 0.7) {
      areas.push("execution_reliability");
    }

    if (deviation.criticalDeviations > 0) {
      areas.push("prediction_accuracy");
    }

    if (actual.unexpectedEvents.length > 2) {
      areas.push("environment_modeling");
    }

    if (actual.adaptationsRequired > 2) {
      areas.push("plan_flexibility");
    }

    for (const [category, count] of Object.entries(deviation.deviationCategories)) {
      if (count > 1) {
        areas.push(`${category}_consistency`);
      }
    }

    if (areas.length === 0) {
      areas.push("continuous_improvement");
    }

    return areas;
  }

  private identifyStrengths(actual: ExecuteResult, comparison: Comparison): string[] {
    const strengths: string[] = [];

    if (actual.successRate >= 0.8) {
      strengths.push("High execution success rate");
    }

    if (actual.unexpectedEvents.length === 0) {
      strengths.push("No unexpected events during execution");
    }

    if (actual.adaptationsRequired === 0) {
      strengths.push("Plan executed without requiring adaptations");
    }

    if (comparison.matchScore >= 0.8) {
      strengths.push("Strong alignment between simulation and execution");
    }

    if (comparison.overallAssessment === "excellent") {
      strengths.push("Excellent overall execution performance");
    }

    if (strengths.length === 0) {
      strengths.push("Execution completed despite challenges");
    }

    return strengths;
  }

  private generateRecommendations(
    improvementAreas: string[],
    deviation: DeviationAnalysis
  ): string[] {
    const recommendations: string[] = [];

    for (const area of improvementAreas) {
      switch (area) {
        case "execution_reliability":
          recommendations.push("Improve execution reliability through better error handling and retry mechanisms");
          break;
        case "prediction_accuracy":
          recommendations.push("Enhance simulation model accuracy by incorporating execution feedback data");
          break;
        case "environment_modeling":
          recommendations.push("Expand environment modeling to capture more edge cases and external factors");
          break;
        case "plan_flexibility":
          recommendations.push("Increase plan flexibility by generating more alternative paths during simulation");
          break;
        case "continuous_improvement":
          recommendations.push("Continue monitoring and refining the execution process");
          break;
        default:
          recommendations.push(`Address improvement area: ${area}`);
      }
    }

    if (deviation.correctiveActions.length > 0) {
      recommendations.push(...deviation.correctiveActions.slice(0, 3));
    }

    return recommendations;
  }

  private categorizeLesson(lesson: string): string {
    const lower = lesson.toLowerCase();
    if (lower.includes("success") || lower.includes("rate")) return "performance";
    if (lower.includes("unexpected") || lower.includes("event")) return "predictability";
    if (lower.includes("adaptation") || lower.includes("flexib")) return "adaptability";
    if (lower.includes("simulation") || lower.includes("prediction")) return "accuracy";
    if (lower.includes("validat")) return "validation";
    return "general";
  }

  private updateStrategyPoolFromLearning(
    result: { lessonsLearned: string[]; performanceScore: number; improvementAreas: string[] },
    pool: StrategyPool
  ): void {
    const fitnessAdjustment = result.performanceScore > 0.7 ? 0.05 : -0.05;

    for (const [geneId, gene] of pool.genes) {
      if (gene.active) {
        gene.fitness = Math.max(0, Math.min(1, gene.fitness + fitnessAdjustment * 0.1));
      }
    }

    pool.averageFitness = Array.from(pool.genes.values())
      .filter((g) => g.active)
      .reduce((sum, g) => sum + g.fitness, 0) / Math.max(pool.genes.size, 1);
  }

  private updateWorldModelPostReflection(
    deviation: DeviationAnalysis,
    worldModel: WorldModelState
  ): void {
    if (deviation.criticalDeviations > 0) {
      for (const [goalId, goal] of worldModel.goalStack.goals) {
        if (goal.state === GoalState.Active && goal.progress < 0.3) {
          worldModel.goalStack.goals.set(goalId, {
            ...goal,
            progress: Math.max(goal.progress, 0.1),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    if (deviation.totalDeviations > 3) {
      for (const [constraintId, constraint] of worldModel.constraintMap.constraints) {
        if (constraint.status === ConstraintStatus.Active && constraint.type === "soft") {
          worldModel.constraintMap.constraints.set(constraintId, {
            ...constraint,
            status: ConstraintStatus.Relaxed,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }
  }
}
