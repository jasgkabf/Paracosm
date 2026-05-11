import type { SimulationResult, SimulationScore, SimulationViolation } from "@paracosm/shared";
import { SimulationPath } from "./path.js";
import type {
  SimulationReport as SimReport,
  RiskAnalysis,
  CostAnalysis,
  PathComparison,
  ComparisonReport,
  VisualizationData,
  TokenEstimate,
  PathComparison as PathComp,
  Tradeoff,
} from "./types.js";

export class SimulationReport {
  generate(paths: SimulationPath[], bestPath: SimulationPath | null): SimReport {
    const scores = paths.map((p) =>
      p.evaluate({
        feasibility: 0.2,
        efficiency: 0.15,
        risk: 0.2,
        goalAlignment: 0.2,
        constraintSatisfaction: 0.1,
        resourceUtilization: 0.05,
        novelty: 0.05,
        robustness: 0.05,
      })
    );

    const averageScore = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
    const scoreVariance = scores.length > 0
      ? scores.reduce((s, v) => s + Math.pow(v - averageScore, 2), 0) / scores.length
      : 0;

    const bestPathScore = bestPath
      ? bestPath.evaluate({
          feasibility: 0.2,
          efficiency: 0.15,
          risk: 0.2,
          goalAlignment: 0.2,
          constraintSatisfaction: 0.1,
          resourceUtilization: 0.05,
          novelty: 0.05,
          robustness: 0.05,
        })
      : 0;

    const riskAnalysis = this.computeRiskAnalysis(paths);
    const costAnalysis = this.computeCostAnalysis(paths);
    const recommendations = this.generateRecommendations(paths, bestPath, riskAnalysis, costAnalysis);

    const pathComparison = paths.length >= 2
      ? this.computePathComparison(paths)
      : null;

    return {
      id: `report_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      simulationId: `sim_${Date.now()}`,
      exploredPathsCount: paths.length,
      bestPathId: bestPath?.getId() ?? null,
      bestPathScore,
      averageScore,
      scoreVariance,
      riskAnalysis,
      costAnalysis,
      recommendations,
      generatedAt: new Date().toISOString(),
      executionTimeMs: 0,
      pathComparison,
    };
  }

  formatDetailed(report: SimReport): string {
    const lines: string[] = [];

    lines.push("=== Simulation Report (Detailed) ===");
    lines.push("");
    lines.push(`Report ID: ${report.id}`);
    lines.push(`Simulation ID: ${report.simulationId}`);
    lines.push(`Generated At: ${report.generatedAt}`);
    lines.push(`Execution Time: ${report.executionTimeMs}ms`);
    lines.push("");
    lines.push("--- Overview ---");
    lines.push(`Explored Paths: ${report.exploredPathsCount}`);
    lines.push(`Best Path: ${report.bestPathId ?? "N/A"}`);
    lines.push(`Best Score: ${report.bestPathScore.toFixed(4)}`);
    lines.push(`Average Score: ${report.averageScore.toFixed(4)}`);
    lines.push(`Score Variance: ${report.scoreVariance.toFixed(6)}`);
    lines.push("");

    lines.push("--- Risk Analysis ---");
    lines.push(`Overall Risk: ${(report.riskAnalysis.overallRisk * 100).toFixed(1)}%`);
    lines.push(`High Risk Paths: ${report.riskAnalysis.highRiskPaths}`);
    lines.push(`Medium Risk Paths: ${report.riskAnalysis.mediumRiskPaths}`);
    lines.push(`Low Risk Paths: ${report.riskAnalysis.lowRiskPaths}`);

    if (report.riskAnalysis.topRiskFactors.length > 0) {
      lines.push("Top Risk Factors:");
      for (const factor of report.riskAnalysis.topRiskFactors.slice(0, 5)) {
        lines.push(`  - ${factor.name}: probability=${(factor.probability * 100).toFixed(1)}%, impact=${(factor.impact * 100).toFixed(1)}%`);
      }
    }
    lines.push("");

    lines.push("--- Cost Analysis ---");
    lines.push(`Total Estimated Cost: $${report.costAnalysis.totalEstimatedCost.toFixed(4)}`);
    lines.push(`Average Cost Per Path: $${report.costAnalysis.averageCostPerPath.toFixed(4)}`);
    lines.push(`Minimum Cost Path: ${report.costAnalysis.minimumCostPath ?? "N/A"}`);
    lines.push(`Token Estimate: ${report.costAnalysis.tokenEstimate.totalTokens} tokens ($${report.costAnalysis.tokenEstimate.estimatedCostUsd.toFixed(4)})`);
    lines.push("");

    if (report.pathComparison) {
      lines.push("--- Path Comparison ---");
      lines.push(`Best vs Average: ${(report.pathComparison.bestVsAverage * 100).toFixed(1)}% improvement`);
      lines.push(`Best vs Worst: ${(report.pathComparison.bestVsWorst * 100).toFixed(1)}% improvement`);
      lines.push(`Pareto Optimal Count: ${report.pathComparison.paretoOptimalCount}`);
      lines.push(`Dominated Count: ${report.pathComparison.dominatedCount}`);
      lines.push("");
    }

    if (report.recommendations.length > 0) {
      lines.push("--- Recommendations ---");
      for (let i = 0; i < report.recommendations.length; i++) {
        lines.push(`${i + 1}. ${report.recommendations[i]}`);
      }
    }

    return lines.join("\n");
  }

  formatSummary(report: SimReport): string {
    const lines: string[] = [];
    lines.push(`Simulation Report: ${report.exploredPathsCount} paths explored`);
    lines.push(`Best: ${report.bestPathId ?? "N/A"} (score: ${report.bestPathScore.toFixed(3)})`);
    lines.push(`Avg score: ${report.averageScore.toFixed(3)}, Risk: ${(report.riskAnalysis.overallRisk * 100).toFixed(1)}%`);
    lines.push(`Cost: $${report.costAnalysis.totalEstimatedCost.toFixed(4)}, Tokens: ${report.costAnalysis.tokenEstimate.totalTokens}`);

    if (report.recommendations.length > 0) {
      lines.push(`Top recommendation: ${report.recommendations[0]}`);
    }

    return lines.join(" | ");
  }

  comparePaths(paths: SimulationPath[]): ComparisonReport {
    if (paths.length === 0) {
      return {
        paths: [],
        bestByScore: "",
        bestByCost: "",
        bestByRisk: "",
        bestByDuration: "",
        consensus: null,
      };
    }

    const pathData = paths.map((p) => ({
      pathId: p.getId(),
      score: p.evaluate({
        feasibility: 0.2,
        efficiency: 0.15,
        risk: 0.2,
        goalAlignment: 0.2,
        constraintSatisfaction: 0.1,
        resourceUtilization: 0.05,
        novelty: 0.05,
        robustness: 0.05,
      }),
      cost: p.getTotalCost(),
      risk: p.getTotalRisk(),
      duration: p.getEstimatedDuration(),
      rank: 0,
    }));

    const sortedByScore = [...pathData].sort((a, b) => b.score - a.score);
    const sortedByCost = [...pathData].sort((a, b) => a.cost - b.cost);
    const sortedByRisk = [...pathData].sort((a, b) => a.risk - b.risk);
    const sortedByDuration = [...pathData].sort((a, b) => a.duration - b.duration);

    for (let i = 0; i < sortedByScore.length; i++) {
      const entry = pathData.find((p) => p.pathId === sortedByScore[i].pathId);
      if (entry) entry.rank = i + 1;
    }

    const bestByScore = sortedByScore[0]?.pathId ?? "";
    const bestByCost = sortedByCost[0]?.pathId ?? "";
    const bestByRisk = sortedByRisk[0]?.pathId ?? "";
    const bestByDuration = sortedByDuration[0]?.pathId ?? "";

    const consensus = bestByScore === bestByCost && bestByCost === bestByRisk
      ? bestByScore
      : bestByScore === bestByRisk
        ? bestByScore
        : null;

    return {
      paths: pathData,
      bestByScore,
      bestByCost,
      bestByRisk,
      bestByDuration,
      consensus,
    };
  }

  visualize(path: SimulationPath): VisualizationData {
    const nodes: Array<{ id: string; label: string; x: number; y: number; score: number }> = [];
    const edges: Array<{ source: string; target: string; weight: number }> = [];
    const highlights: string[] = [];

    const pathNodes = path.getNodes();
    const pathEdges = path.getEdges();

    const radius = 200;
    const centerX = 400;
    const centerY = 300;

    for (let i = 0; i < pathNodes.length; i++) {
      const angle = (2 * Math.PI * i) / pathNodes.length;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      nodes.push({
        id: pathNodes[i].id,
        label: pathNodes[i].action,
        x,
        y,
        score: 1.0 - pathNodes[i].risk,
      });
    }

    for (const edge of pathEdges) {
      edges.push({
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        weight: edge.probability,
      });
    }

    if (pathNodes.length > 0) {
      highlights.push(pathNodes[0].id);
      highlights.push(pathNodes[pathNodes.length - 1].id);
    }

    return {
      nodes,
      edges,
      highlights,
      metadata: {
        pathId: path.getId(),
        totalCost: path.getTotalCost(),
        totalRisk: path.getTotalRisk(),
        estimatedDuration: path.getEstimatedDuration(),
        nodeCount: pathNodes.length,
      },
    };
  }

  private computeRiskAnalysis(paths: SimulationPath[]): RiskAnalysis {
    let highRisk = 0;
    let mediumRisk = 0;
    let lowRisk = 0;
    let totalRisk = 0;

    const riskDistribution = new Map<string, number>();

    for (const path of paths) {
      const risk = path.getTotalRisk();
      totalRisk += risk;

      if (risk > 0.7) {
        highRisk++;
        riskDistribution.set("high", (riskDistribution.get("high") ?? 0) + 1);
      } else if (risk > 0.3) {
        mediumRisk++;
        riskDistribution.set("medium", (riskDistribution.get("medium") ?? 0) + 1);
      } else {
        lowRisk++;
        riskDistribution.set("low", (riskDistribution.get("low") ?? 0) + 1);
      }
    }

    const overallRisk = paths.length > 0 ? totalRisk / paths.length : 0;

    const topRiskFactors: import("./types.js").RiskFactor[] = [];
    for (const path of paths) {
      const nodes = path.getNodes();
      for (const node of nodes) {
        if (node.risk > 0.5) {
          topRiskFactors.push({
            id: `rf_${node.id}`,
            name: `Risk from ${node.action}`,
            description: `High risk action: ${node.action} on entity ${node.entityId}`,
            probability: node.risk,
            impact: node.risk * 0.8,
            riskScore: node.risk * node.risk * 10,
            mitigation: `Consider alternative to ${node.action}`,
            category: "action_risk",
          });
        }
      }
    }

    topRiskFactors.sort((a, b) => b.riskScore - a.riskScore);

    return {
      overallRisk,
      highRiskPaths: highRisk,
      mediumRiskPaths: mediumRisk,
      lowRiskPaths: lowRisk,
      topRiskFactors: topRiskFactors.slice(0, 10),
      riskDistribution,
    };
  }

  private computeCostAnalysis(paths: SimulationPath[]): CostAnalysis {
    let totalCost = 0;
    let minCost = Infinity;
    let minCostPath: string | null = null;
    const costDistribution = new Map<string, number>();

    for (const path of paths) {
      const cost = path.getTotalCost();
      totalCost += cost;

      if (cost < minCost) {
        minCost = cost;
        minCostPath = path.getId();
      }

      const bucket = cost < 0.5 ? "low" : cost < 1.5 ? "medium" : "high";
      costDistribution.set(bucket, (costDistribution.get(bucket) ?? 0) + 1);
    }

    const averageCostPerPath = paths.length > 0 ? totalCost / paths.length : 0;

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    for (const path of paths) {
      const nodeCount = path.getNodeCount();
      totalInputTokens += nodeCount * 150;
      totalOutputTokens += nodeCount * 50;
    }

    const tokenEstimate: TokenEstimate = {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      estimatedCostUsd: (totalInputTokens * 0.00003 + totalOutputTokens * 0.00006),
    };

    return {
      totalEstimatedCost: totalCost,
      averageCostPerPath,
      minimumCostPath: minCostPath,
      costDistribution,
      tokenEstimate,
    };
  }

  private generateRecommendations(
    paths: SimulationPath[],
    bestPath: SimulationPath | null,
    riskAnalysis: RiskAnalysis,
    costAnalysis: CostAnalysis
  ): string[] {
    const recommendations: string[] = [];

    if (bestPath) {
      const bestRisk = bestPath.getTotalRisk();
      if (bestRisk > 0.5) {
        recommendations.push("Best path has significant risk; consider risk mitigation strategies before execution");
      }

      const bestCost = bestPath.getTotalCost();
      if (bestCost > 2.0) {
        recommendations.push("Best path has high cost; explore cost optimization opportunities");
      }

      const bestDuration = bestPath.getEstimatedDuration();
      if (bestDuration > 5000) {
        recommendations.push("Best path has long estimated duration; consider parallelizing steps where possible");
      }
    }

    if (riskAnalysis.highRiskPaths > paths.length * 0.3) {
      recommendations.push("Over 30% of paths are high risk; review action parameters to reduce risk exposure");
    }

    if (paths.length < 5) {
      recommendations.push("Few paths explored; consider increasing exploration parameters for better coverage");
    }

    if (costAnalysis.tokenEstimate.totalTokens > 100000) {
      recommendations.push("High token usage expected; consider batching or reducing simulation depth");
    }

    if (recommendations.length === 0) {
      recommendations.push("Simulation results look favorable; proceed with the best path");
    }

    return recommendations;
  }

  private computePathComparison(paths: SimulationPath[]): PathComp {
    const scores = paths.map((p) =>
      p.evaluate({
        feasibility: 0.2,
        efficiency: 0.15,
        risk: 0.2,
        goalAlignment: 0.2,
        constraintSatisfaction: 0.1,
        resourceUtilization: 0.05,
        novelty: 0.05,
        robustness: 0.05,
      })
    );

    const bestScore = Math.max(...scores);
    const worstScore = Math.min(...scores);
    const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;

    const paretoOptimalCount = Math.max(1, Math.floor(paths.length * 0.3));
    const dominatedCount = paths.length - paretoOptimalCount;

    const tradeoffs: Tradeoff[] = [];
    if (paths.length >= 2) {
      const pathA = paths[0];
      const pathB = paths[1];
      const costA = pathA.getTotalCost();
      const costB = pathB.getTotalCost();

      tradeoffs.push({
        dimension: "cost",
        pathAId: pathA.getId(),
        pathBId: pathB.getId(),
        pathAValue: costA,
        pathBValue: costB,
        difference: Math.abs(costA - costB),
      });
    }

    return {
      bestVsAverage: bestScore - avgScore,
      bestVsWorst: bestScore - worstScore,
      paretoOptimalCount,
      dominatedCount,
      tradeoffs,
    };
  }
}
