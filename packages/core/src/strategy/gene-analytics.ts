import type { StrategyGene, EvolutionResult } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('GeneAnalytics');

export class GeneAnalytics {
  private evolutionHistory: EvolutionResult[] = [];

  recordEvolution(result: EvolutionResult): void {
    this.evolutionHistory.push(result);
    if (this.evolutionHistory.length > 1000) {
      this.evolutionHistory.shift();
    }
  }

  getFitnessTrend(): Array<{ generation: number; bestFitness: number; avgFitness: number; worstFitness: number }> {
    return this.evolutionHistory.map((r) => ({
      generation: r.generation,
      bestFitness: r.bestFitness,
      avgFitness: r.averageFitness,
      worstFitness: r.worstFitness,
    }));
  }

  getDiversityTrend(): Array<{ generation: number; diversity: number }> {
    return this.evolutionHistory.map((r) => ({
      generation: r.generation,
      diversity: r.diversity,
    }));
  }

  getConvergenceRate(): number {
    if (this.evolutionHistory.length < 2) return 0;
    const first = this.evolutionHistory[0];
    const last = this.evolutionHistory[this.evolutionHistory.length - 1];
    const generations = last.generation - first.generation;
    if (generations === 0) return 0;
    return (last.bestFitness - first.bestFitness) / generations;
  }

  getStagnationPeriods(): Array<{ startGen: number; endGen: number; duration: number }> {
    const periods: Array<{ startGen: number; endGen: number; duration: number }> = [];
    let startGen: number | null = null;
    for (let i = 1; i < this.evolutionHistory.length; i++) {
      const improvement = this.evolutionHistory[i].bestFitness - this.evolutionHistory[i - 1].bestFitness;
      if (improvement <= 0.001 && startGen === null) {
        startGen = this.evolutionHistory[i - 1].generation;
      } else if (improvement > 0.001 && startGen !== null) {
        periods.push({
          startGen,
          endGen: this.evolutionHistory[i - 1].generation,
          duration: this.evolutionHistory[i - 1].generation - startGen,
        });
        startGen = null;
      }
    }
    if (startGen !== null) {
      const lastGen = this.evolutionHistory[this.evolutionHistory.length - 1].generation;
      periods.push({ startGen, endGen: lastGen, duration: lastGen - startGen });
    }
    return periods;
  }

  analyzeGene(gene: StrategyGene): { lineageDepth: number; mutationRate: number; fitnessRank: string; age: number } {
    const lineageDepth = gene.parentIds.length;
    const age = Date.now() - gene.createdAt.getTime();
    const mutationRate = gene.mutationCount / Math.max(age / 86400000, 1);
    let fitnessRank: string;
    if (gene.fitness >= 0.8) fitnessRank = 'elite';
    else if (gene.fitness >= 0.6) fitnessRank = 'above_average';
    else if (gene.fitness >= 0.4) fitnessRank = 'average';
    else if (gene.fitness >= 0.2) fitnessRank = 'below_average';
    else fitnessRank = 'poor';
    return { lineageDepth, mutationRate, fitnessRank, age };
  }

  getSummary(): { totalGenerations: number; totalImprovements: number; avgConvergenceRate: number; stagnationPeriods: number } {
    return {
      totalGenerations: this.evolutionHistory.length,
      totalImprovements: this.evolutionHistory.reduce((sum, r) => sum + r.improvements, 0),
      avgConvergenceRate: this.getConvergenceRate(),
      stagnationPeriods: this.getStagnationPeriods().length,
    };
  }

  clear(): void {
    this.evolutionHistory = [];
  }
}
