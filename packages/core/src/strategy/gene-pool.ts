import { GeneType } from "@paracosm/shared";
import { StrategyGene } from "./gene.js";
import type { GeneInternal, PoolStats } from "./types.js";

export class GenePool {
  private genes: Map<string, StrategyGene>;
  private protectedIds: Set<string>;
  private generation: number;
  private stagnationCount: number;

  constructor() {
    this.genes = new Map();
    this.protectedIds = new Set();
    this.generation = 0;
    this.stagnationCount = 0;
  }

  add(gene: StrategyGene): void {
    const id = gene.id as string;
    if (this.genes.has(id)) {
      throw new Error(`Gene with id ${id} already exists in pool`);
    }
    this.genes.set(id, gene);
  }

  remove(id: string): void {
    if (this.protectedIds.has(id)) {
      throw new Error(`Cannot remove protected gene: ${id}`);
    }
    this.genes.delete(id);
  }

  get(id: string): StrategyGene | null {
    return this.genes.get(id) ?? null;
  }

  has(id: string): boolean {
    return this.genes.has(id);
  }

  select(n: number, method: "tournament" | "roulette" | "rank" | "random" = "tournament"): StrategyGene[] {
    const active = this.getActiveGenes();
    if (active.length === 0) {
      return [];
    }

    const count = Math.min(n, active.length);
    const selected: StrategyGene[] = [];

    switch (method) {
      case "tournament":
        for (let i = 0; i < count; i++) {
          selected.push(this.tournamentSelect(active, 3));
        }
        break;
      case "roulette":
        for (let i = 0; i < count; i++) {
          selected.push(this.rouletteSelect(active));
        }
        break;
      case "rank":
        for (let i = 0; i < count; i++) {
          selected.push(this.rankSelect(active));
        }
        break;
      case "random":
        for (let i = 0; i < count; i++) {
          const idx = Math.floor(Math.random() * active.length);
          selected.push(active[idx]);
        }
        break;
    }

    return selected;
  }

  rank(): StrategyGene[] {
    const genes = Array.from(this.genes.values());
    return genes.sort((a, b) => b.fitness - a.fitness);
  }

  prune(maxSize: number): void {
    const currentSize = this.genes.size;
    if (currentSize <= maxSize) {
      return;
    }

    const ranked = this.rank();
    const toRemove = currentSize - maxSize;
    let removed = 0;

    for (let i = ranked.length - 1; i >= 0 && removed < toRemove; i--) {
      const id = ranked[i].id as string;
      if (!this.protectedIds.has(id)) {
        this.genes.delete(id);
        removed++;
      }
    }
  }

  protect(ids: string[]): void {
    for (const id of ids) {
      if (this.genes.has(id)) {
        this.protectedIds.add(id);
      }
    }
  }

  unprotect(ids: string[]): void {
    for (const id of ids) {
      this.protectedIds.delete(id);
    }
  }

  isProtected(id: string): boolean {
    return this.protectedIds.has(id);
  }

  introduce(gene: StrategyGene): void {
    this.genes.set(gene.id as string, gene);
  }

  diversity(): number {
    const genes = Array.from(this.genes.values());
    if (genes.length < 2) {
      return genes.length === 1 ? 0 : 0;
    }

    let totalSimilarity = 0;
    let comparisons = 0;

    const sampleSize = Math.min(genes.length, 50);
    const sample: StrategyGene[] = [];
    const usedIndices = new Set<number>();

    while (sample.length < sampleSize) {
      const idx = Math.floor(Math.random() * genes.length);
      if (!usedIndices.has(idx)) {
        usedIndices.add(idx);
        sample.push(genes[idx]);
      }
    }

    for (let i = 0; i < sample.length; i++) {
      for (let j = i + 1; j < sample.length; j++) {
        totalSimilarity += sample[i].similarity(sample[j]);
        comparisons++;
      }
    }

    if (comparisons === 0) {
      return 0;
    }

    const averageSimilarity = totalSimilarity / comparisons;
    return 1 - averageSimilarity;
  }

  stats(): PoolStats {
    const genes = Array.from(this.genes.values());
    const activeGenes = genes.filter((g) => g.active);
    const inactiveGenes = genes.filter((g) => !g.active);

    const fitnessValues = genes.map((g) => g.fitness);
    const avgFitness = fitnessValues.length > 0
      ? fitnessValues.reduce((sum, f) => sum + f, 0) / fitnessValues.length
      : 0;
    const maxFitness = fitnessValues.length > 0 ? Math.max(...fitnessValues) : 0;
    const minFitness = fitnessValues.length > 0 ? Math.min(...fitnessValues) : 0;

    const fitnessVariance = fitnessValues.length > 0
      ? fitnessValues.reduce((sum, f) => sum + Math.pow(f - avgFitness, 2), 0) / fitnessValues.length
      : 0;

    const typeDistribution: Record<string, number> = {};
    for (const gene of genes) {
      const type = gene.type as string;
      typeDistribution[type] = (typeDistribution[type] ?? 0) + 1;
    }

    const originDistribution: Record<string, number> = {};
    for (const gene of genes) {
      originDistribution[gene.origin] = (originDistribution[gene.origin] ?? 0) + 1;
    }

    const typeSet = new Set(Object.keys(typeDistribution));

    return {
      size: genes.length,
      activeCount: activeGenes.length,
      inactiveCount: inactiveGenes.length,
      averageFitness: avgFitness,
      maxFitness,
      minFitness,
      fitnessVariance,
      diversityIndex: this.diversity(),
      generation: this.generation,
      speciesCount: typeSet.size,
      typeDistribution,
      originDistribution,
    };
  }

  getSize(): number {
    return this.genes.size;
  }

  getGeneration(): number {
    return this.generation;
  }

  setGeneration(generation: number): void {
    this.generation = generation;
  }

  getStagnationCount(): number {
    return this.stagnationCount;
  }

  incrementStagnation(): void {
    this.stagnationCount++;
  }

  resetStagnation(): void {
    this.stagnationCount = 0;
  }

  getAllGenes(): StrategyGene[] {
    return Array.from(this.genes.values());
  }

  getActiveGenes(): StrategyGene[] {
    return Array.from(this.genes.values()).filter((g) => g.active);
  }

  getGenesByType(type: GeneType): StrategyGene[] {
    return Array.from(this.genes.values()).filter((g) => g.type === type);
  }

  getGenesByOrigin(origin: GeneInternal["origin"]): StrategyGene[] {
    return Array.from(this.genes.values()).filter((g) => g.origin === origin);
  }

  getTopGenes(n: number): StrategyGene[] {
    return this.rank().slice(0, n);
  }

  getBottomGenes(n: number): StrategyGene[] {
    return this.rank().reverse().slice(0, n);
  }

  getTotalFitness(): number {
    let total = 0;
    for (const gene of this.genes.values()) {
      total += gene.fitness;
    }
    return total;
  }

  getAverageFitness(): number {
    if (this.genes.size === 0) {
      return 0;
    }
    return this.getTotalFitness() / this.genes.size;
  }

  clear(): void {
    this.genes.clear();
    this.protectedIds.clear();
    this.stagnationCount = 0;
  }

  toData(): object {
    const genes: object[] = [];
    for (const gene of this.genes.values()) {
      genes.push(gene.serialize());
    }
    return {
      genes,
      generation: this.generation,
      speciesCount: new Set(Array.from(this.genes.values()).map((g) => g.type)).size,
      totalFitness: this.getTotalFitness(),
      averageFitness: this.getAverageFitness(),
      diversityIndex: this.diversity(),
      stagnationCount: this.stagnationCount,
      protectedIds: Array.from(this.protectedIds),
    };
  }

  private tournamentSelect(candidates: StrategyGene[], tournamentSize: number): StrategyGene {
    const size = Math.min(tournamentSize, candidates.length);
    const tournament: StrategyGene[] = [];

    for (let i = 0; i < size; i++) {
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

  private rouletteSelect(candidates: StrategyGene[]): StrategyGene {
    const totalFitness = candidates.reduce((sum, g) => sum + g.fitness, 0);
    if (totalFitness === 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    let threshold = Math.random() * totalFitness;
    for (const gene of candidates) {
      threshold -= gene.fitness;
      if (threshold <= 0) {
        return gene;
      }
    }
    return candidates[candidates.length - 1];
  }

  private rankSelect(candidates: StrategyGene[]): StrategyGene {
    const sorted = [...candidates].sort((a, b) => b.fitness - a.fitness);
    const n = sorted.length;
    const rankWeights = sorted.map((_, i) => (n - i) / n);
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
}
