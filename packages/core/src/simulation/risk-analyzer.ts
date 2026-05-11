import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { SimulationError } from "@paracosm/shared";
import type {
  RiskAssessment,
  RiskFactor,
  RiskMatrix,
  Hazard,
  Impact,
  Likelihood,
  Mitigation,
  PathNode,
} from "./types.js";
import { Snapshot } from "./snapshot.js";

export class RiskAnalyzer {
  private hazardRegistry: Map<string, Hazard>;
  private mitigationRegistry: Map<string, Mitigation>;
  private riskThreshold: number;

  constructor(riskThreshold: number = 0.7) {
    this.hazardRegistry = new Map();
    this.mitigationRegistry = new Map();
    this.riskThreshold = riskThreshold;
  }

  analyzeRisk(action: PathNode, snapshot: Snapshot): Result<RiskAssessment, SimulationError> {
    const hazards = this.identifyHazards(action);
    const riskFactors: RiskFactor[] = [];

    for (const hazard of hazards) {
      const impact = this.assessImpact(hazard);
      const likelihood = this.assessLikelihood(hazard);

      const riskScore = likelihood.probability * impact.score;

      const riskFactor: RiskFactor = {
        id: hazard.id,
        name: hazard.name,
        description: hazard.description,
        probability: likelihood.probability,
        impact: impact.score,
        riskScore,
        mitigation: this.generateMitigationText(hazard, impact, likelihood),
        category: hazard.category,
      };

      riskFactors.push(riskFactor);
      this.hazardRegistry.set(hazard.id, hazard);
    }

    const highRiskFactors = riskFactors.filter(
      (rf) => rf.riskScore > this.riskThreshold * 0.5
    );

    const overallRisk = riskFactors.length > 0
      ? riskFactors.reduce((sum, rf) => sum + rf.riskScore, 0) / riskFactors.length
      : 0;

    const mitigationStrategies = this.mitigationStrategies(riskFactors).map(
      (m) => m.strategy
    );

    const confidence = this.computeConfidence(hazards, snapshot);

    const assessment: RiskAssessment = {
      overallRisk: Math.min(1, overallRisk),
      riskFactors,
      highRiskFactors,
      mitigationStrategies,
      confidence,
      assessedAt: new Date().toISOString(),
    };

    return ok(assessment);
  }

  identifyHazards(action: PathNode): Hazard[] {
    const hazards: Hazard[] = [];
    let hazardCounter = 0;

    if (action.risk > 0.5) {
      hazards.push({
        id: `hazard_${Date.now()}_${hazardCounter++}`,
        name: "High intrinsic risk",
        description: `Action "${action.action}" has high intrinsic risk level (${(action.risk * 100).toFixed(1)}%)`,
        category: "intrinsic",
        likelihood: action.risk,
        impact: action.risk * 0.8,
        riskScore: action.risk * action.risk * 0.8,
        affectedEntities: [action.entityId] as any[],
        detectability: 0.7,
      });
    }

    if (action.cost > 1.0) {
      hazards.push({
        id: `hazard_${Date.now()}_${hazardCounter++}`,
        name: "High resource cost",
        description: `Action "${action.action}" requires significant resources (cost: ${action.cost.toFixed(2)})`,
        category: "resource",
        likelihood: 0.6,
        impact: Math.min(1, action.cost / 3),
        riskScore: 0.6 * Math.min(1, action.cost / 3),
        affectedEntities: [action.entityId] as any[],
        detectability: 0.9,
      });
    }

    if (action.duration > 1000) {
      hazards.push({
        id: `hazard_${Date.now()}_${hazardCounter++}`,
        name: "Long execution time",
        description: `Action "${action.action}" has long duration (${action.duration.toFixed(0)}ms)`,
        category: "temporal",
        likelihood: 0.5,
        impact: Math.min(1, action.duration / 5000),
        riskScore: 0.5 * Math.min(1, action.duration / 5000),
        affectedEntities: [action.entityId] as any[],
        detectability: 0.8,
      });
    }

    if (action.action === "delete") {
      hazards.push({
        id: `hazard_${Date.now()}_${hazardCounter++}`,
        name: "Destructive action",
        description: `Action "${action.action}" is destructive and may cause irreversible changes`,
        category: "destructive",
        likelihood: 0.7,
        impact: 0.9,
        riskScore: 0.63,
        affectedEntities: [action.entityId] as any[],
        detectability: 0.6,
      });
    }

    if (action.action === "merge" || action.action === "split") {
      hazards.push({
        id: `hazard_${Date.now()}_${hazardCounter++}`,
        name: "Structural modification",
        description: `Action "${action.action}" modifies entity structure, potentially affecting dependencies`,
        category: "structural",
        likelihood: 0.4,
        impact: 0.6,
        riskScore: 0.24,
        affectedEntities: [action.entityId] as any[],
        detectability: 0.7,
      });
    }

    if (action.action === "transform") {
      hazards.push({
        id: `hazard_${Date.now()}_${hazardCounter++}`,
        name: "Data transformation risk",
        description: `Action "${action.action}" may alter data in unexpected ways`,
        category: "data",
        likelihood: 0.3,
        impact: 0.5,
        riskScore: 0.15,
        affectedEntities: [action.entityId] as any[],
        detectability: 0.5,
      });
    }

    if (hazards.length === 0) {
      hazards.push({
        id: `hazard_${Date.now()}_default`,
        name: "General execution risk",
        description: `Standard risk associated with executing action "${action.action}"`,
        category: "general",
        likelihood: 0.2,
        impact: 0.3,
        riskScore: 0.06,
        affectedEntities: [action.entityId] as any[],
        detectability: 0.8,
      });
    }

    return hazards;
  }

  assessImpact(hazard: Hazard): Impact {
    const score = hazard.impact;

    let severity: Impact["severity"];
    if (score >= 0.8) severity = "critical";
    else if (score >= 0.5) severity = "high";
    else if (score >= 0.3) severity = "medium";
    else severity = "low";

    const scope = this.determineScope(hazard);
    const reversible = hazard.category !== "destructive" && hazard.impact < 0.7;
    const recoveryTimeMs = this.estimateRecoveryTime(hazard);
    const financialCost = this.estimateFinancialCost(hazard);

    return {
      severity,
      score,
      scope,
      reversible,
      recoveryTimeMs,
      financialCost,
    };
  }

  assessLikelihood(hazard: Hazard): Likelihood {
    const probability = hazard.likelihood;

    let frequency: Likelihood["frequency"];
    if (probability >= 0.9) frequency = "almost_certain";
    else if (probability >= 0.6) frequency = "likely";
    else if (probability >= 0.3) frequency = "possible";
    else if (probability >= 0.1) frequency = "unlikely";
    else frequency = "rare";

    const historicalOccurrences = this.getHistoricalOccurrences(hazard);
    const trendDirection = this.determineTrend(hazard);

    return {
      probability,
      frequency,
      historicalOccurrences,
      trendDirection,
    };
  }

  riskMatrix(hazards: Hazard[]): RiskMatrix {
    const likelihoodLevels = ["rare", "unlikely", "possible", "likely", "almost_certain"];
    const impactLevels = ["low", "medium", "high", "critical"];

    const grid: number[][] = [];
    for (let i = 0; i < likelihoodLevels.length; i++) {
      const row: number[] = [];
      for (let j = 0; j < impactLevels.length; j++) {
        const likelihoodScore = (i + 1) / likelihoodLevels.length;
        const impactScore = (j + 1) / impactLevels.length;
        row.push(likelihoodScore * impactScore);
      }
      grid.push(row);
    }

    for (const hazard of hazards) {
      const lIdx = this.getLikelihoodIndex(hazard.likelihood);
      const iIdx = this.getImpactIndex(hazard.impact);
      if (lIdx >= 0 && lIdx < grid.length && iIdx >= 0 && iIdx < grid[lIdx].length) {
        grid[lIdx][iIdx] = Math.max(grid[lIdx][iIdx], hazard.riskScore);
      }
    }

    let maxValue = 0;
    for (const row of grid) {
      for (const val of row) {
        if (val > maxValue) maxValue = val;
      }
    }

    return {
      dimensions: ["likelihood", "impact"],
      grid,
      labels: [...likelihoodLevels, ...impactLevels],
      maxValue,
    };
  }

  mitigationStrategies(risks: RiskFactor[]): Mitigation[] {
    const mitigations: Mitigation[] = [];

    for (const risk of risks) {
      if (risk.riskScore < 0.1) continue;

      const strategies = this.generateMitigationStrategies(risk);
      mitigations.push(...strategies);
    }

    mitigations.sort((a, b) => b.priority - a.priority);

    return mitigations;
  }

  getRiskThreshold(): number {
    return this.riskThreshold;
  }

  setRiskThreshold(threshold: number): void {
    this.riskThreshold = Math.max(0, Math.min(1, threshold));
  }

  getHazardRegistry(): Map<string, Hazard> {
    return new Map(this.hazardRegistry);
  }

  private generateMitigationText(hazard: Hazard, impact: Impact, likelihood: Likelihood): string {
    if (hazard.category === "destructive") {
      return "Create backup before executing; verify rollback capability";
    }
    if (hazard.category === "resource") {
      return "Pre-allocate resources; implement resource monitoring and alerts";
    }
    if (hazard.category === "temporal") {
      return "Break into smaller steps; implement timeout and retry logic";
    }
    if (hazard.category === "structural") {
      return "Validate dependencies before modification; use staged rollout";
    }
    if (hazard.category === "data") {
      return "Validate input/output schemas; implement data integrity checks";
    }
    return `Monitor ${hazard.name} during execution; have contingency plan ready`;
  }

  private computeConfidence(hazards: Hazard[], snapshot: Snapshot): number {
    let confidence = 0.8;

    const entityCount = snapshot.getEntityCount();
    if (entityCount < 5) confidence -= 0.1;
    if (entityCount > 100) confidence -= 0.05;

    const highImpactCount = hazards.filter((h) => h.impact > 0.7).length;
    confidence -= highImpactCount * 0.05;

    const lowDetectabilityCount = hazards.filter((h) => h.detectability < 0.5).length;
    confidence -= lowDetectabilityCount * 0.1;

    return Math.max(0.1, Math.min(1, confidence));
  }

  private determineScope(hazard: Hazard): string[] {
    const scope: string[] = [];
    scope.push(hazard.category);

    if (hazard.affectedEntities.length > 1) {
      scope.push("multi_entity");
    }

    if (hazard.impact > 0.7) {
      scope.push("system_wide");
    }

    return scope;
  }

  private estimateRecoveryTime(hazard: Hazard): number {
    const baseTime = 1000;
    const impactMultiplier = hazard.impact * 5;
    const categoryMultiplier = hazard.category === "destructive" ? 10 : 1;

    return baseTime * impactMultiplier * categoryMultiplier;
  }

  private estimateFinancialCost(hazard: Hazard): number {
    const baseCost = 0.01;
    const impactCost = hazard.impact * 0.5;
    const categoryCost = hazard.category === "destructive" ? 0.5 : 0.1;

    return baseCost + impactCost + categoryCost;
  }

  private getHistoricalOccurrences(hazard: Hazard): number {
    let count = 0;
    for (const [, h] of this.hazardRegistry) {
      if (h.category === hazard.category && h.name === hazard.name) {
        count++;
      }
    }
    return count;
  }

  private determineTrend(hazard: Hazard): Likelihood["trendDirection"] {
    const recent = Array.from(this.hazardRegistry.values())
      .filter((h) => h.category === hazard.category)
      .slice(-5);

    if (recent.length < 2) return "stable";

    const recentLikelihood = recent.slice(-2).reduce((s, h) => s + h.likelihood, 0) / 2;
    const olderLikelihood = recent.slice(0, -2).length > 0
      ? recent.slice(0, -2).reduce((s, h) => s + h.likelihood, 0) / recent.slice(0, -2).length
      : recentLikelihood;

    if (recentLikelihood > olderLikelihood * 1.1) return "increasing";
    if (recentLikelihood < olderLikelihood * 0.9) return "decreasing";
    return "stable";
  }

  private getLikelihoodIndex(likelihood: number): number {
    if (likelihood >= 0.8) return 4;
    if (likelihood >= 0.6) return 3;
    if (likelihood >= 0.4) return 2;
    if (likelihood >= 0.2) return 1;
    return 0;
  }

  private getImpactIndex(impact: number): number {
    if (impact >= 0.75) return 3;
    if (impact >= 0.5) return 2;
    if (impact >= 0.25) return 1;
    return 0;
  }

  private generateMitigationStrategies(risk: RiskFactor): Mitigation[] {
    const mitigations: Mitigation[] = [];
    let mitigationCounter = 0;

    if (risk.riskScore > 0.5) {
      mitigations.push({
        id: `mit_${Date.now()}_${mitigationCounter++}`,
        hazardId: risk.id,
        strategy: `Implement checkpoint before ${risk.category} action to enable rollback`,
        effectiveness: 0.7,
        cost: 0.1,
        implementationTime: 500,
        residualRisk: risk.riskScore * 0.3,
        priority: Math.floor(risk.riskScore * 10),
      });
    }

    if (risk.probability > 0.5) {
      mitigations.push({
        id: `mit_${Date.now()}_${mitigationCounter++}`,
        hazardId: risk.id,
        strategy: `Add validation step to reduce likelihood of ${risk.name}`,
        effectiveness: 0.5,
        cost: 0.05,
        implementationTime: 200,
        residualRisk: risk.riskScore * 0.5,
        priority: Math.floor(risk.probability * 8),
      });
    }

    mitigations.push({
      id: `mit_${Date.now()}_${mitigationCounter++}`,
      hazardId: risk.id,
      strategy: `Monitor ${risk.name} during execution and alert on threshold breach`,
      effectiveness: 0.3,
      cost: 0.02,
      implementationTime: 100,
      residualRisk: risk.riskScore * 0.7,
      priority: Math.floor(risk.riskScore * 5),
    });

    return mitigations;
  }
}
