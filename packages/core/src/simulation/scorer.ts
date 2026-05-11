import type { SimulationScore, SimulationPath } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';
import type { ScoringCriteria } from './types.js';

const logger = createLogger('Scorer');

export class Scorer {
  private criteria: ScoringCriteria;

  constructor(criteria?: Partial<ScoringCriteria>) {
    this.criteria = {
      weights: criteria?.weights ?? {
        feasibility: 0.3,
        impact: 0.25,
        risk: 0.2,
        efficiency: 0.15,
        robustness: 0.1,
      },
      thresholds: criteria?.thresholds ?? {
        feasibility: 0.5,
        impact: 0.3,
        risk: 0.7,
        efficiency: 0.4,
        robustness: 0.3,
      },
      penalties: criteria?.penalties ?? {
        highRisk: 0.3,
        lowEfficiency: 0.2,
        poorRobustness: 0.15,
      },
    };
  }

  score(path: SimulationPath): SimulationScore {
    const feasibility = this.scoreFeasibility(path);
    const impact = this.scoreImpact(path);
    const risk = this.scoreRisk(path);
    const efficiency = this.scoreEfficiency(path);
    const robustness = this.scoreRobustness(path);
    const breakdown: Record<string, number> = { feasibility, impact, risk, efficiency, robustness };
    let overall = 0;
    for (const [dimension, weight] of Object.entries(this.criteria.weights)) {
      const score = breakdown[dimension] ?? 0;
      overall += weight * score;
    }
    if (risk > this.criteria.thresholds.risk) {
      overall -= this.criteria.penalties.highRisk;
    }
    if (efficiency < this.criteria.thresholds.efficiency) {
      overall -= this.criteria.penalties.lowEfficiency;
    }
    if (robustness < this.criteria.thresholds.robustness) {
      overall -= this.criteria.penalties.poorRobustness;
    }
    overall = Math.min(Math.max(overall, 0), 1);
    return {
      pathId: path.id,
      overall,
      feasibility,
      impact,
      risk,
      efficiency,
      robustness,
      breakdown,
    };
  }

  scoreAll(paths: SimulationPath[]): SimulationScore[] {
    return paths.map((path) => this.score(path));
  }

  rankPaths(paths: SimulationPath[]): Array<{ path: SimulationPath; score: SimulationScore; rank: number }> {
    const scored = paths.map((path) => ({
      path,
      score: this.score(path),
      rank: 0,
    }));
    scored.sort((a, b) => b.score.overall - a.score.overall);
    scored.forEach((item, index) => { item.rank = index + 1; });
    return scored;
  }

  private scoreFeasibility(path: SimulationPath): number {
    if (path.steps.length === 0) return 0.1;
    let score = 0.5;
    score += Math.min(path.probability, 0.3);
    if (path.steps.length <= 5) score += 0.1;
    else if (path.steps.length > 15) score -= 0.1;
    const avgDuration = path.totalDuration / path.steps.length;
    if (avgDuration < 1000) score += 0.1;
    else if (avgDuration > 10000) score -= 0.1;
    return Math.min(Math.max(score, 0), 1);
  }

  private scoreImpact(path: SimulationPath): number {
    let score = 0.5;
    const lastStep = path.steps[path.steps.length - 1];
    if (lastStep) {
      const metrics = lastStep.snapshot.metrics;
      const metricValues = Object.values(metrics);
      if (metricValues.length > 0) {
        const avgMetric = metricValues.reduce((a, b) => a + b, 0) / metricValues.length;
        score = Math.min(avgMetric / 100, 1);
      }
    }
    if (path.outcome === 'success') score += 0.2;
    else if (path.outcome === 'failure') score -= 0.3;
    return Math.min(Math.max(score, 0), 1);
  }

  private scoreRisk(path: SimulationPath): number {
    let riskScore = 0.3;
    if (path.probability < 0.3) riskScore += 0.3;
    else if (path.probability < 0.5) riskScore += 0.15;
    if (path.steps.length > 10) riskScore += 0.1;
    const failedTransitions = path.steps.filter((s) => s.transitions.some((t) => t.includes('fail') || t.includes('error')));
    riskScore += (failedTransitions.length / Math.max(path.steps.length, 1)) * 0.2;
    return Math.min(Math.max(riskScore, 0), 1);
  }

  private scoreEfficiency(path: SimulationPath): number {
    if (path.steps.length === 0) return 0.5;
    const avgDuration = path.totalDuration / path.steps.length;
    let score = 0.5;
    if (avgDuration < 500) score += 0.3;
    else if (avgDuration < 2000) score += 0.15;
    else if (avgDuration > 10000) score -= 0.2;
    if (path.steps.length < 5) score += 0.1;
    return Math.min(Math.max(score, 0), 1);
  }

  private scoreRobustness(path: SimulationPath): number {
    let score = 0.5;
    const uniqueTransitions = new Set(path.steps.flatMap((s) => s.transitions));
    const transitionDiversity = uniqueTransitions.size / Math.max(path.steps.length, 1);
    score += transitionDiversity * 0.2;
    if (path.probability > 0.7) score += 0.15;
    if (path.outcome === 'success') score += 0.1;
    return Math.min(Math.max(score, 0), 1);
  }

  setWeights(weights: Record<string, number>): void {
    this.criteria.weights = { ...this.criteria.weights, ...weights };
  }

  getCriteria(): ScoringCriteria {
    return { ...this.criteria };
  }
}
