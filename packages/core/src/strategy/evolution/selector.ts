import type { StrategyGene, GeneId, EvolutionConfig } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('Selector');

export class Selector {
  private config: EvolutionConfig;

  constructor(config: EvolutionConfig) {
    this.config = config;
  }

  select(genes: StrategyGene[], count: number): StrategyGene[] {
    switch (this.config.selectionMethod) {
      case 'tournament':
        return this.tournamentSelection(genes, count);
      case 'roulette':
        return this.rouletteSelection(genes, count);
      case 'rank':
        return this.rankSelection(genes, count);
      case 'sus':
        return this.stochasticUniversalSampling(genes, count);
      default:
        return this.tournamentSelection(genes, count);
    }
  }

  private tournamentSelection(genes: StrategyGene[], count: number): StrategyGene[] {
    const selected: StrategyGene[] = [];
    for (let i = 0; i < count; i++) {
      const tournament: StrategyGene[] = [];
      for (let j = 0; j < this.config.tournamentSize; j++) {
        const idx = Math.floor(Math.random() * genes.length);
        tournament.push(genes[idx]);
      }
      const winner = tournament.reduce((best, current) =>
        current.fitness > best.fitness ? current : best,
      );
      selected.push(winner);
    }
    return selected;
  }

  private rouletteSelection(genes: StrategyGene[], count: number): StrategyGene[] {
    const totalFitness = genes.reduce((sum, g) => sum + Math.max(g.fitness, 0.001), 0);
    const selected: StrategyGene[] = [];
    for (let i = 0; i < count; i++) {
      let threshold = Math.random() * totalFitness;
      for (const gene of genes) {
        threshold -= Math.max(gene.fitness, 0.001);
        if (threshold <= 0) {
          selected.push(gene);
          break;
        }
      }
      if (selected.length <= i) {
        selected.push(genes[Math.floor(Math.random() * genes.length)]);
      }
    }
    return selected;
  }

  private rankSelection(genes: StrategyGene[], count: number): StrategyGene[] {
    const sorted = [...genes].sort((a, b) => b.fitness - a.fitness);
    const selected: StrategyGene[] = [];
    const totalRank = sorted.length * (sorted.length + 1) / 2;
    for (let i = 0; i < count; i++) {
      let threshold = Math.random() * totalRank;
      for (let rank = 0; rank < sorted.length; rank++) {
        threshold -= (sorted.length - rank);
        if (threshold <= 0) {
          selected.push(sorted[rank]);
          break;
        }
      }
      if (selected.length <= i) {
        selected.push(sorted[0]);
      }
    }
    return selected;
  }

  private stochasticUniversalSampling(genes: StrategyGene[], count: number): StrategyGene[] {
    const totalFitness = genes.reduce((sum, g) => sum + Math.max(g.fitness, 0.001), 0);
    const step = totalFitness / count;
    let start = Math.random() * step;
    const selected: StrategyGene[] = [];
    let currentIdx = 0;
    let cumulativeFitness = Math.max(genes[0]?.fitness ?? 0, 0.001);
    for (let i = 0; i < count; i++) {
      while (start > cumulativeFitness && currentIdx < genes.length - 1) {
        currentIdx++;
        cumulativeFitness += Math.max(genes[currentIdx].fitness, 0.001);
      }
      selected.push(genes[currentIdx]);
      start += step;
    }
    return selected;
  }
}
