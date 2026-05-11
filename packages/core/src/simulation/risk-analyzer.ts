import type { RiskAssessment } from '@paracosm/shared';
import { generateId, createLogger } from '@paracosm/shared';

const logger = createLogger('RiskAnalyzer');

export class RiskAnalyzer {
  private riskFactors: Map<string, Array<{ name: string; probability: number; impact: number; description: string; mitigation: string }>> = new Map();

  analyze(pathData: Array<{ id: string; probability: number; metrics: Record<string, number>; outcome: string }>): RiskAssessment[] {
    const assessments: RiskAssessment[] = [];
    for (const path of pathData) {
      const riskFactors = this.identifyRiskFactors(path);
      const overallRiskScore = this.computeOverallRisk(riskFactors);
      const riskLevel = this.classifyRisk(overallRiskScore);
      const assessment: RiskAssessment = {
        id: generateId(),
        pathId: path.id,
        riskLevel,
        riskFactors,
        overallRiskScore,
        timestamp: new Date(),
      };
      assessments.push(assessment);
    }
    return assessments;
  }

  addRiskFactor(category: string, factor: { name: string; probability: number; impact: number; description: string; mitigation: string }): void {
    const factors = this.riskFactors.get(category) ?? [];
    factors.push(factor);
    this.riskFactors.set(category, factors);
  }

  private identifyRiskFactors(path: { id: string; probability: number; metrics: Record<string, number>; outcome: string }): RiskAssessment['riskFactors'] {
    const factors: RiskAssessment['riskFactors'] = [];
    if (path.probability < 0.3) {
      factors.push({
        name: 'Low Path Probability',
        probability: 1 - path.probability,
        impact: 0.8,
        description: `Path has low probability of ${path.probability.toFixed(2)}`,
        mitigation: 'Consider alternative paths with higher probability',
      });
    }
    if (path.outcome === 'failure') {
      factors.push({
        name: 'Failure Outcome',
        probability: 0.9,
        impact: 0.9,
        description: 'Path results in failure',
        mitigation: 'Identify and address failure causes',
      });
    }
    for (const [metric, value] of Object.entries(path.metrics)) {
      if (metric.toLowerCase().includes('error') && value > 0.1) {
        factors.push({
          name: `High ${metric}`,
          probability: Math.min(value, 1),
          impact: 0.6,
          description: `${metric} is elevated at ${value.toFixed(2)}`,
          mitigation: `Monitor and reduce ${metric}`,
        });
      }
      if (metric.toLowerCase().includes('latency') && value > 5000) {
        factors.push({
          name: `High ${metric}`,
          probability: 0.7,
          impact: 0.5,
          description: `${metric} is ${value.toFixed(0)}ms`,
          mitigation: 'Optimize performance to reduce latency',
        });
      }
    }
    for (const [category, knownFactors] of this.riskFactors) {
      for (const factor of knownFactors) {
        if (path.metrics[category] !== undefined || path.outcome.includes(category)) {
          factors.push({ ...factor });
        }
      }
    }
    return factors;
  }

  private computeOverallRisk(factors: RiskAssessment['riskFactors']): number {
    if (factors.length === 0) return 0;
    let totalRisk = 0;
    for (const factor of factors) {
      totalRisk += factor.probability * factor.impact;
    }
    return Math.min(totalRisk / factors.length, 1);
  }

  private classifyRisk(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 0.8) return 'critical';
    if (score >= 0.6) return 'high';
    if (score >= 0.3) return 'medium';
    return 'low';
  }

  clear(): void {
    this.riskFactors.clear();
  }
}
