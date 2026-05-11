import { StrategyGene } from "../gene.js";
import { GenePool } from "../gene-pool.js";
import type { SelectionConfig } from "../types.js";
import { DEFAULT_SELECTION_CONFIG } from "../types.js";

export class Selector {
  private config: SelectionConfig;

  constructor(config?: Partial<SelectionConfig>) {
    this.config = { ...DEFAULT_SELECTION_CONFIG, ...config };
  }

  tournamentSelect(pool: GenePool, tournamentSize?: number): StrategyGene {
    const size = tournamentSize ?? this.config.tournamentSize;
    const candidates = pool.getActiveGenes();
    if (candidates.length === 0) {
      throw new Error("Cannot select from empty pool");
    }

    const actualSize = Math.min(size, candidates.length);
    const tournament: StrategyGene[] = [];

    for (let i = 0; i < actualSize; i++) {
      const idx = Math.floor(Math.random() * candidates.length);
      tournament.push(candidates[idx]);
    }

    let best = tournament[0];
    for (let i = 1; i < tournament.length; i++) {
      if (tournament[i].fitness > best.fitness) {
        best = tournament[i];
      }
    }
    return best;
  }

  rouletteSelect(pool: GenePool): StrategyGene {
    const candidates = pool.getActiveGenes();
    if (candidates.length === 0) {
      throw new Error("Cannot select from empty pool");
    }

    const totalFitness = candidates.reduce((sum, g) => sum + Math.max(g.fitness, 0.001), 0);
    let threshold = Math.random() * totalFitness;

    for (const gene of candidates) {
      threshold -= Math.max(gene.fitness, 0.001);
      if (threshold <= 0) {
        return gene;
      }
    }
    return candidates[candidates.length - 1];
  }

  rankSelect(pool: GenePool): StrategyGene {
    const candidates = pool.getActiveGenes();
    if (candidates.length === 0) {
      throw new Error("Cannot select from empty pool");
    }

    const sorted = [...candidates].sort((a, b) => b.fitness - a.fitness);
    const n = sorted.length;
    const pressure = this.config.selectionPressure;

    const rankWeights = sorted.map((_, i) => {
      const rank = i + 1;
      return (2 - pressure) / n + (2 * (pressure - 1) * (n - rank)) / (n * (n - 1));
    });

    const totalWeight = rankWeights.reduce((sum, w) => sum + w, 0);
    let threshold = Math.random() * totalWeight;

    for (let i = 0; i < sorted.length; i++) {
      threshold -= rankWeights[i];
      if (threshold <= 0) {
        return sorted[i];
      }
    }
    return sorted[sorted.length - 1];
  }

  elitePreserve(pool: GenePool, n?: number): StrategyGene[] {
    const count = n ?? this.config.elitismCount;
    return pool.getTopGenes(count);
  }

  diversityMaintain(pool: GenePool, threshold?: number): StrategyGene[] {
    const diversityThreshold = threshold ?? this.config.diversityThreshold;
    const currentDiversity = pool.diversity();

    if (currentDiversity >= diversityThreshold) {
      return [];
    }

    const candidates = pool.getActiveGenes();
    if (candidates.length < 2) {
      return [];
    }

    const selected: StrategyGene[] = [];
    const selectedIds = new Set<string>();
    const targetCount = Math.max(1, Math.floor(candidates.length * 0.1));

    const sorted = [...candidates].sort((a, b) => b.fitness - a.fitness);

    for (const candidate of sorted) {
      if (selected.length >= targetCount) {
        break;
      }

      const candidateId = candidate.id as string;
      if (selectedIds.has(candidateId)) {
        continue;
      }

      let isDiverse = true;
      for (const existing of selected) {
        const similarity = candidate.similarity(existing);
        if (similarity > 1 - diversityThreshold) {
          isDiverse = false;
          break;
        }
      }

      if (isDiverse) {
        selected.push(candidate);
        selectedIds.add(candidateId);
      }
    }

    return selected;
  }

  selectParents(pool: GenePool, count: number): StrategyGene[][] {
    const pairs: StrategyGene[][] = [];
    const method = this.config.method;

    for (let i = 0; i < count; i++) {
      let parentA: StrategyGene;
      let parentB: StrategyGene;

      switch (method) {
        case "tournament":
          parentA = this.tournamentSelect(pool);
          parentB = this.tournamentSelect(pool);
          break;
        case "roulette":
          parentA = this.rouletteSelect(pool);
          parentB = this.rouletteSelect(pool);
          break;
        case "rank":
          parentA = this.rankSelect(pool);
          parentB = this.rankSelect(pool);
          break;
        default:
          parentA = this.tournamentSelect(pool);
          parentB = this.tournamentSelect(pool);
      }

      let attempts = 0;
      while (parentA.id === parentB.id && attempts < 10) {
        parentB = this.tournamentSelect(pool);
        attempts++;
      }

      pairs.push([parentA, parentB]);
    }

    return pairs;
  }

  stochasticUniversalSampling(pool: GenePool, count: number): StrategyGene[] {
    const candidates = pool.getActiveGenes();
    if (candidates.length === 0) {
      return [];
    }

    const totalFitness = candidates.reduce((sum, g) => sum + Math.max(g.fitness, 0.001), 0);
    const step = totalFitness / count;
    let start = Math.random() * step;

    const selected: StrategyGene[] = [];
    let cumulative = 0;

    for (const gene of candidates) {
      cumulative += Math.max(gene.fitness, 0.001);
      while (start <= cumulative && selected.length < count) {
        selected.push(gene);
        start += step;
      }
    }

    return selected;
  }

  boltzmannSelect(pool: GenePool, temperature: number): StrategyGene {
    const candidates = pool.getActiveGenes();
    if (candidates.length === 0) {
      throw new Error("Cannot select from empty pool");
    }

    if (temperature <= 0) {
      return pool.getTopGenes(1)[0];
    }

    const boltzmannWeights = candidates.map((g) => Math.exp(g.fitness / temperature));
    const totalWeight = boltzmannWeights.reduce((sum, w) => sum + w, 0);

    let threshold = Math.random() * totalWeight;
    for (let i = 0; i < candidates.length; i++) {
      threshold -= boltzmannWeights[i];
      if (threshold <= 0) {
        return candidates[i];
      }
    }
    return candidates[candidates.length - 1];
  }

  setConfig(config: Partial<SelectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SelectionConfig {
    return { ...this.config };
  }
}
