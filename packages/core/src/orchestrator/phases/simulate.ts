import type {
  ScoredPath,
  SimulationReportInternal,
  UncertaintyHandling,
  DebateContextInternal,
  SimulationPathInternal,
} from "./../types.js";
import { DebateOutcome, DebateVoteType } from "@paracosm/shared";
import type {
  SimulateResult,
  SimulationPath,
  SimulationResult,
  SimulationScore,
  SimulationSnapshot,
  SimulationViolation,
  RiskAssessment,
  RiskFactor,
  WorldModelState,
  EntityId,
  ConstraintId,
  GoalId,
  DebateResult,
  PersonaId,
  PersonaCombination,
} from "@paracosm/shared";
import { generateId } from "@paracosm/shared";

interface DebateRound {
  roundNumber: number;
  proposals: Array<{ personaId: string; content: string; score: number }>;
  critiques: Array<{ personaId: string; targetProposal: string; content: string; severity: number }>;
}

interface DebateState {
  topic: string;
  rounds: DebateRound[];
  currentRound: number;
  maxRounds: number;
  consensusLevel: number;
  winningProposalId: string | null;
}

export class SimulatePhase {
  private simulationCache: Map<string, SimulationPath[]>;
  private debateCache: Map<string, DebateResult>;

  constructor() {
    this.simulationCache = new Map();
    this.debateCache = new Map();
  }

  execute(context: {
    worldModel: WorldModelState;
    personaCombination: PersonaCombination | null;
    simulationConfig: {
      maxPaths: number;
      maxSteps: number;
      timeLimitMs: number;
      branchFactor: number;
      pruningThreshold: number;
    };
  }): SimulateResult {
    const startTime = Date.now();

    const paths = this.explorePaths(
      { simulate: () => ({ paths: [], bestPathId: null }) } as any,
      {
        id: generateId(),
        pathId: generateId(),
        stepNumber: 0,
        state: {},
        entityStates: new Map(),
        activeConstraints: [],
        activeGoals: [],
        timestamp: new Date().toISOString(),
      }
    );

    const scoredPaths = this.scorePaths(paths);
    const bestPath = this.selectBestPath(scoredPaths);
    const bestScoredPath = scoredPaths.length > 0 ? scoredPaths[0] : null;
    const report = this.generateReport(bestScoredPath ? { path: bestScoredPath.path, score: bestScoredPath.overallScore, risk: bestScoredPath.riskScore, feasibility: bestScoredPath.feasibilityScore, novelty: 0.5 } : null);
    const uncertainty = bestPath ? this.handleUncertainty(bestPath) : null;

    let debateResult: DebateResult | null = null;
    if (context.personaCombination && context.personaCombination.personaIds.length >= 2) {
      debateResult = this.runDebate(
        context.personaCombination.personaIds,
        `Best path selection for simulation`
      );
    }

    const riskAssessment = this.generateRiskAssessment(scoredPaths, context.worldModel);

    const simulationResults: SimulationResult[] = scoredPaths.map((scored) => ({
      pathId: scored.path.id as string,
      score: {
        overall: scored.overallScore,
        feasibility: scored.feasibilityScore,
        efficiency: scored.efficiencyScore,
        risk: scored.riskScore,
        goalAlignment: scored.goalAlignmentScore,
        constraintSatisfaction: scored.constraintSatisfactionScore,
        resourceUtilization: 0.5,
        breakdown: {},
      },
      finalState: {
        id: generateId(),
        pathId: scored.path.id as string,
        stepNumber: scored.path.steps.length,
        state: {},
        entityStates: new Map(),
        activeConstraints: [],
        activeGoals: [],
        timestamp: new Date().toISOString(),
      },
      violations: [],
      insights: this.generateInsights(scored),
      recommendations: this.generateRecommendations(scored, riskAssessment),
      executionTime: Date.now() - startTime,
    }));

    const bestSimResult = simulationResults.length > 0 ? simulationResults[0] : null;

    const pathsPruned = Math.max(0, context.simulationConfig.maxPaths - scoredPaths.length);

    return {
      simulations: simulationResults,
      bestPath: bestSimResult,
      riskAssessment,
      pathsExplored: paths.length,
      pathsPruned,
      duration: Date.now() - startTime,
    };
  }

  runDebate(personas: PersonaId[], topic: string): DebateResult {
    const cacheKey = `${topic}:${personas.join(",")}`;
    const cached = this.debateCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const startTime = Date.now();
    const state: DebateState = {
      topic,
      rounds: [],
      currentRound: 0,
      maxRounds: 3,
      consensusLevel: 0,
      winningProposalId: null,
    };

    for (let round = 1; round <= state.maxRounds; round++) {
      state.currentRound = round;

      const proposals = this.generateProposals(personas, topic, round);
      const critiques = this.generateCritiques(personas, proposals, round);

      state.rounds.push({
        roundNumber: round,
        proposals,
        critiques,
      });

      state.consensusLevel = this.calculateConsensus(proposals, critiques);

      if (state.consensusLevel >= 0.7) {
        break;
      }
    }

    const winningProposal = this.determineWinner(state);
    const keyInsights = this.extractKeyInsights(state);
    const unresolvedIssues = this.identifyUnresolvedIssues(state);

    const outcome = this.determineOutcome(state.consensusLevel);

    const result: DebateResult = {
      outcome,
      winningProposalId: winningProposal?.id ?? null,
      votes: this.generateVotes(personas, winningProposal),
      consensusLevel: state.consensusLevel,
      keyInsights,
      unresolvedIssues,
      finalSynthesis: this.synthesizeDebate(state),
      duration: Date.now() - startTime,
    };

    this.debateCache.set(cacheKey, result);
    return result;
  }

  explorePaths(
    simEngine: { simulate: (input: unknown) => { paths: SimulationPath[]; bestPathId: string | null } },
    snapshot: SimulationSnapshot
  ): SimulationPath[] {
    const paths: SimulationPath[] = [];

    const basePath: SimulationPath = {
      id: generateId(),
      steps: [],
      probability: 1.0,
      totalDuration: 0,
      branchPoint: null,
      parentPathId: null,
      childPathIds: [],
    };
    paths.push(basePath);

    const branchFactors = [0.8, 0.6, 0.4, 0.3, 0.2];
    for (let i = 0; i < branchFactors.length; i++) {
      const branchPath: SimulationPath = {
        id: generateId(),
        steps: [],
        probability: branchFactors[i],
        totalDuration: Math.floor(Math.random() * 5000) + 1000,
        branchPoint: 0,
        parentPathId: basePath.id,
        childPathIds: [],
      };
      paths.push(branchPath);
      basePath.childPathIds.push(branchPath.id);
    }

    for (const path of paths) {
      const stepCount = Math.floor(Math.random() * 5) + 3;
      for (let s = 0; s < stepCount; s++) {
        path.steps.push({
          stepNumber: s,
          timestamp: new Date().toISOString(),
          entityId: generateId() as EntityId,
          action: `action_${s}`,
          parameters: {},
          result: "completed",
          duration: Math.floor(Math.random() * 500) + 100,
          stateDelta: {},
        });
      }
      path.totalDuration = path.steps.reduce((sum, step) => sum + step.duration, 0);
    }

    return paths;
  }

  scorePaths(paths: SimulationPath[]): ScoredPath[] {
    const scoredPaths: ScoredPath[] = paths.map((path) => {
      const feasibilityScore = this.calculateFeasibility(path);
      const riskScore = this.calculateRisk(path);
      const goalAlignmentScore = this.calculateGoalAlignment(path);
      const constraintSatisfactionScore = this.calculateConstraintSatisfaction(path);
      const efficiencyScore = this.calculateEfficiency(path);

      const overallScore =
        feasibilityScore * 0.25 +
        (1 - riskScore) * 0.2 +
        goalAlignmentScore * 0.25 +
        constraintSatisfactionScore * 0.15 +
        efficiencyScore * 0.15;

      return {
        path,
        overallScore,
        feasibilityScore,
        riskScore,
        goalAlignmentScore,
        constraintSatisfactionScore,
        efficiencyScore,
        rank: 0,
      };
    });

    scoredPaths.sort((a, b) => b.overallScore - a.overallScore);
    for (let i = 0; i < scoredPaths.length; i++) {
      scoredPaths[i].rank = i + 1;
    }

    return scoredPaths;
  }

  selectBestPath(scoredPaths: ScoredPath[]): SimulationPath | null {
    if (scoredPaths.length === 0) {
      return null;
    }

    const topPaths = scoredPaths.filter(
      (sp) => sp.overallScore >= scoredPaths[0].overallScore * 0.9
    );

    if (topPaths.length === 1) {
      return topPaths[0].path;
    }

    const selected = topPaths.reduce((best, current) => {
      const bestEfficiency = best.efficiencyScore;
      const currentEfficiency = current.efficiencyScore;
      return currentEfficiency > bestEfficiency ? current : best;
    });

    return selected.path;
  }

  generateReport(bestPath: SimulationPathInternal | null): SimulationReportInternal {
    const startTime = Date.now();

    return {
      bestPathId: bestPath?.path?.id ?? generateId(),
      bestScore: bestPath?.score ?? 0,
      pathsExplored: 5,
      pathsPruned: 2,
      riskAssessment: {
        overallRisk: bestPath ? 1 - bestPath.score : 0.5,
        highRiskFactors: [],
        mitigationStrategies: bestPath ? ["Monitor execution closely", "Prepare rollback plan"] : [],
      },
      recommendations: bestPath
        ? ["Proceed with best path", "Monitor for deviations", "Prepare contingency plans"]
        : ["No viable path found", "Consider relaxing constraints", "Gather more information"],
      duration: Date.now() - startTime,
    };
  }

  handleUncertainty(path: SimulationPath): UncertaintyHandling {
    const uncertaintyLevel = this.assessPathUncertainty(path);

    const contingencies = this.generateContingencies(path, uncertaintyLevel);

    const fallbackStrategy = this.determineFallbackStrategy(uncertaintyLevel);

    const monitoringPoints = this.identifyMonitoringPoints(path);

    return {
      pathId: path.id,
      uncertaintyLevel,
      contingencies,
      fallbackStrategy,
      monitoringPoints,
    };
  }

  private generateProposals(
    personas: PersonaId[],
    topic: string,
    round: number
  ): Array<{ personaId: string; content: string; score: number }> {
    return personas.map((personaId, index) => ({
      personaId: personaId as string,
      content: `Proposal from persona ${index + 1} on "${topic}" (round ${round})`,
      score: Math.random() * 0.5 + 0.3,
    }));
  }

  private generateCritiques(
    personas: PersonaId[],
    proposals: Array<{ personaId: string; content: string; score: number }>,
    round: number
  ): Array<{ personaId: string; targetProposal: string; content: string; severity: number }> {
    const critiques: Array<{ personaId: string; targetProposal: string; content: string; severity: number }> = [];

    for (const personaId of personas) {
      const targetProposal = proposals.find((p) => p.personaId !== (personaId as string));
      if (targetProposal) {
        critiques.push({
          personaId: personaId as string,
          targetProposal: targetProposal.personaId,
          content: `Critique from ${personaId} on proposal by ${targetProposal.personaId}`,
          severity: Math.random() * 0.5 + 0.2,
        });
      }
    }

    return critiques;
  }

  private calculateConsensus(
    proposals: Array<{ personaId: string; content: string; score: number }>,
    critiques: Array<{ personaId: string; targetProposal: string; content: string; severity: number }>
  ): number {
    if (proposals.length === 0) return 0;

    const avgProposalScore = proposals.reduce((sum, p) => sum + p.score, 0) / proposals.length;
    const avgCritiqueSeverity = critiques.length > 0
      ? critiques.reduce((sum, c) => sum + c.severity, 0) / critiques.length
      : 0;

    return Math.max(0, Math.min(1, avgProposalScore - avgCritiqueSeverity * 0.5));
  }

  private determineWinner(state: DebateState): { id: string; score: number } | null {
    if (state.rounds.length === 0) return null;

    const lastRound = state.rounds[state.rounds.length - 1];
    if (lastRound.proposals.length === 0) return null;

    const bestProposal = lastRound.proposals.reduce((best, current) =>
      current.score > best.score ? current : best
    );

    return { id: bestProposal.personaId, score: bestProposal.score };
  }

  private extractKeyInsights(state: DebateState): string[] {
    const insights: string[] = [];

    for (const round of state.rounds) {
      const topProposal = round.proposals.reduce((best, current) =>
        current.score > best.score ? current : best, { score: -1, personaId: "", content: "" }
      );
      if (topProposal.content) {
        insights.push(topProposal.content);
      }
    }

    if (state.consensusLevel >= 0.7) {
      insights.push("Strong consensus achieved among personas");
    } else if (state.consensusLevel >= 0.4) {
      insights.push("Moderate agreement with some dissenting views");
    } else {
      insights.push("Low consensus - significant disagreement remains");
    }

    return insights;
  }

  private identifyUnresolvedIssues(state: DebateState): string[] {
    const issues: string[] = [];

    if (state.consensusLevel < 0.7) {
      issues.push("Full consensus was not reached");
    }

    for (const round of state.rounds) {
      const highSeverityCritiques = round.critiques.filter((c) => c.severity > 0.5);
      for (const critique of highSeverityCritiques) {
        issues.push(`Unresolved high-severity critique from ${critique.personaId}`);
      }
    }

    return issues;
  }

  private determineOutcome(consensusLevel: number): DebateOutcome {
    if (consensusLevel >= 0.8) return DebateOutcome.Consensus;
    if (consensusLevel >= 0.5) return DebateOutcome.Majority;
    if (consensusLevel >= 0.3) return DebateOutcome.Disagreement;
    return DebateOutcome.Inconclusive;
  }

  private generateVotes(
    personas: PersonaId[],
    winner: { id: string; score: number } | null
  ): DebateResult["votes"] {
    return personas.map((personaId) => ({
      personaId,
      proposalId: winner?.id ?? "",
      vote: Math.random() > 0.3 ? DebateVoteType.For : DebateVoteType.Against,
      reasoning: `Vote reasoning from ${personaId as string}`,
      weight: Math.random() * 0.5 + 0.5,
      timestamp: new Date().toISOString(),
    }));
  }

  private synthesizeDebate(state: DebateState): string {
    const totalRounds = state.rounds.length;
    const totalProposals = state.rounds.reduce((sum, r) => sum + r.proposals.length, 0);
    const totalCritiques = state.rounds.reduce((sum, r) => sum + r.critiques.length, 0);

    return `Debate completed in ${totalRounds} rounds with ${totalProposals} proposals and ${totalCritiques} critiques. Consensus level: ${(state.consensusLevel * 100).toFixed(1)}%.`;
  }

  private calculateFeasibility(path: SimulationPath): number {
    if (path.steps.length === 0) return 0.5;
    const avgDuration = path.totalDuration / path.steps.length;
    const feasibility = Math.max(0, 1 - avgDuration / 10000);
    return Math.min(feasibility, 1);
  }

  private calculateRisk(path: SimulationPath): number {
    const stepCount = path.steps.length;
    const probability = path.probability;
    const riskFromSteps = Math.min(stepCount * 0.05, 0.5);
    const riskFromProbability = 1 - probability;
    return Math.min(riskFromSteps * 0.6 + riskFromProbability * 0.4, 1);
  }

  private calculateGoalAlignment(path: SimulationPath): number {
    if (path.steps.length === 0) return 0.3;
    const completedSteps = path.steps.filter((s) => s.result === "completed").length;
    return completedSteps / path.steps.length;
  }

  private calculateConstraintSatisfaction(path: SimulationPath): number {
    return Math.max(0.3, 1 - path.probability * 0.2);
  }

  private calculateEfficiency(path: SimulationPath): number {
    if (path.steps.length === 0) return 0.5;
    const avgDuration = path.totalDuration / path.steps.length;
    return Math.max(0.1, 1 - avgDuration / 5000);
  }

  private generateRiskAssessment(
    scoredPaths: ScoredPath[],
    worldModel: WorldModelState
  ): RiskAssessment {
    const riskFactors: RiskFactor[] = [];

    if (scoredPaths.length > 0) {
      const bestPath = scoredPaths[0];
      riskFactors.push({
        id: generateId(),
        name: "Path execution risk",
        description: "Risk associated with executing the best simulation path",
        probability: bestPath.riskScore,
        impact: bestPath.riskScore * 0.8,
        riskScore: bestPath.riskScore * 0.8,
        mitigation: "Monitor execution and prepare rollback strategies",
        category: "execution",
      });
    }

    if (scoredPaths.length < 3) {
      riskFactors.push({
        id: generateId(),
        name: "Limited path diversity",
        description: "Few alternative paths available",
        probability: 0.5,
        impact: 0.6,
        riskScore: 0.3,
        mitigation: "Explore additional simulation paths",
        category: "planning",
      });
    }

    const overallRisk = riskFactors.length > 0
      ? riskFactors.reduce((sum, rf) => sum + rf.riskScore, 0) / riskFactors.length
      : 0.5;

    const highRiskFactors = riskFactors.filter((rf) => rf.riskScore > 0.5);

    return {
      overallRisk,
      riskFactors,
      highRiskFactors,
      mitigationStrategies: riskFactors.map((rf) => rf.mitigation),
      confidence: Math.max(0.3, 1 - overallRisk),
      assessedAt: new Date().toISOString(),
    };
  }

  private generateInsights(scoredPath: ScoredPath): string[] {
    const insights: string[] = [];

    if (scoredPath.feasibilityScore > 0.7) {
      insights.push("Path shows high feasibility");
    } else if (scoredPath.feasibilityScore < 0.4) {
      insights.push("Path has low feasibility - consider alternatives");
    }

    if (scoredPath.riskScore > 0.6) {
      insights.push("High risk detected - mitigation recommended");
    }

    if (scoredPath.goalAlignmentScore > 0.8) {
      insights.push("Strong alignment with goals");
    }

    if (scoredPath.efficiencyScore > 0.7) {
      insights.push("Path is efficient in resource usage");
    }

    return insights;
  }

  private generateRecommendations(
    scoredPath: ScoredPath,
    riskAssessment: RiskAssessment | null
  ): string[] {
    const recommendations: string[] = [];

    if (scoredPath.overallScore > 0.7) {
      recommendations.push("Proceed with this path");
    } else if (scoredPath.overallScore > 0.5) {
      recommendations.push("Proceed with caution - monitor closely");
    } else {
      recommendations.push("Consider alternative approaches");
    }

    if (riskAssessment && riskAssessment.highRiskFactors.length > 0) {
      recommendations.push("Address high-risk factors before execution");
    }

    if (scoredPath.constraintSatisfactionScore < 0.5) {
      recommendations.push("Review and potentially relax constraints");
    }

    return recommendations;
  }

  private assessPathUncertainty(path: SimulationPath): number {
    const stepUncertainty = path.steps.length * 0.05;
    const probabilityUncertainty = 1 - path.probability;
    const branchUncertainty = path.childPathIds.length * 0.1;

    return Math.min(stepUncertainty + probabilityUncertainty + branchUncertainty, 1);
  }

  private generateContingencies(
    path: SimulationPath,
    uncertaintyLevel: number
  ): UncertaintyHandling["contingencies"] {
    const contingencies: UncertaintyHandling["contingencies"] = [];

    if (uncertaintyLevel > 0.3) {
      contingencies.push({
        condition: "Step execution fails",
        alternativeAction: "Retry with modified parameters",
        probability: uncertaintyLevel * 0.5,
      });
    }

    if (uncertaintyLevel > 0.5) {
      contingencies.push({
        condition: "Constraint violation detected",
        alternativeAction: "Switch to alternative path",
        probability: uncertaintyLevel * 0.3,
      });
    }

    if (uncertaintyLevel > 0.7) {
      contingencies.push({
        condition: "Multiple step failures",
        alternativeAction: "Full rollback and re-plan",
        probability: uncertaintyLevel * 0.2,
      });
    }

    return contingencies;
  }

  private determineFallbackStrategy(uncertaintyLevel: number): string {
    if (uncertaintyLevel < 0.3) return "continue_with_monitoring";
    if (uncertaintyLevel < 0.5) return "adaptive_execution_with_checkpoints";
    if (uncertaintyLevel < 0.7) return "conservative_execution_with_rollback";
    return "full_replan_with_alternative_paths";
  }

  private identifyMonitoringPoints(path: SimulationPath): string[] {
    const points: string[] = [];

    for (let i = 0; i < path.steps.length; i++) {
      if (i % 3 === 0 || i === path.steps.length - 1) {
        points.push(`checkpoint_after_step_${i}`);
      }
    }

    if (path.branchPoint !== null) {
      points.push(`branch_point_${path.branchPoint}`);
    }

    return points;
  }
}
