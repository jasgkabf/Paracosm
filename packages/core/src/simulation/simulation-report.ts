import type { SimulationResult, SimulationScore, SimulationPath, RiskAssessment, ResourceEstimate } from '@paracosm/shared';
import { generateId, createLogger } from '@paracosm/shared';

const logger = createLogger('SimulationReport');

export interface SimulationReport {
  id: string;
  simulationId: string;
  summary: string;
  totalPaths: number;
  bestPath: SimulationPath | null;
  bestScore: SimulationScore | null;
  worstPath: SimulationPath | null;
  riskAssessment: RiskAssessment | null;
  resourceEstimate: ResourceEstimate | null;
  recommendations: string[];
  warnings: string[];
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export function generateReport(result: SimulationResult, scores: SimulationScore[], riskAssessment?: RiskAssessment, resourceEstimate?: ResourceEstimate): SimulationReport {
  const bestScore = scores.length > 0 ? scores.reduce((best, s) => s.overall > best.overall ? s : best, scores[0]) : null;
  const worstScore = scores.length > 0 ? scores.reduce((worst, s) => s.overall < worst.overall ? s : worst, scores[0]) : null;
  const bestPath = result.paths.find((p) => p.id === result.bestPathId) ?? null;
  const worstPath = result.paths.find((p) => p.id === result.worstPathId) ?? null;
  const recommendations = generateRecommendations(result, scores);
  const warnings = generateWarnings(result, scores, riskAssessment);
  const summary = generateSummary(result, bestScore);
  return {
    id: generateId(),
    simulationId: result.id,
    summary,
    totalPaths: result.paths.length,
    bestPath,
    bestScore,
    worstPath,
    riskAssessment: riskAssessment ?? null,
    resourceEstimate: resourceEstimate ?? null,
    recommendations,
    warnings,
    timestamp: new Date(),
    metadata: result.metadata,
  };
}

function generateRecommendations(result: SimulationResult, scores: SimulationScore[]): string[] {
  const recommendations: string[] = [];
  if (result.confidence > 0.8) {
    recommendations.push('High confidence in simulation results, proceed with best path');
  } else if (result.confidence > 0.5) {
    recommendations.push('Moderate confidence, consider additional validation before proceeding');
  } else {
    recommendations.push('Low confidence, recommend gathering more data before proceeding');
  }
  const avgScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s.overall, 0) / scores.length : 0;
  if (avgScore < 0.4) {
    recommendations.push('Average path scores are low, consider revising the approach');
  }
  if (result.paths.length < 5) {
    recommendations.push('Few paths explored, consider increasing exploration parameters');
  }
  const highRiskPaths = scores.filter((s) => s.risk > 0.7);
  if (highRiskPaths.length > scores.length / 2) {
    recommendations.push('Majority of paths have high risk, review risk factors');
  }
  return recommendations;
}

function generateWarnings(result: SimulationResult, scores: SimulationScore[], riskAssessment?: RiskAssessment): string[] {
  const warnings: string[] = [];
  if (result.confidence < 0.3) {
    warnings.push('Very low confidence in results');
  }
  if (riskAssessment && riskAssessment.riskLevel === 'critical') {
    warnings.push('Critical risk level detected');
  }
  const failedPaths = result.paths.filter((p) => p.outcome === 'failure');
  if (failedPaths.length > result.paths.length * 0.5) {
    warnings.push('More than half of simulated paths result in failure');
  }
  return warnings;
}

function generateSummary(result: SimulationResult, bestScore: SimulationScore | null): string {
  const parts: string[] = [];
  parts.push(`Simulation explored ${result.paths.length} paths.`);
  if (bestScore) {
    parts.push(`Best path scored ${bestScore.overall.toFixed(2)} overall.`);
  }
  parts.push(`Average score: ${result.averageScore.toFixed(2)}.`);
  parts.push(`Confidence: ${(result.confidence * 100).toFixed(0)}%.`);
  return parts.join(' ');
}
