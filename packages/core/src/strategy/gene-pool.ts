import type { StrategyGene, GeneId, GenePool as GenePoolType } from '@paracosm/shared';
import { generateId, ok, err, type Result, createLogger } from '@paracosm/shared';
import { createGene, cloneGene } from './gene.js';

const logger = createLogger('GenePool');

export class GenePool {
  private genes: Map<GeneId, StrategyGene> = new Map();
  private species: Map<string, Set<GeneId>> = new Map();
  private generation: number = 0;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  addGene(gene: StrategyGene): Result<StrategyGene> {
    if (this.genes.size >= this.maxSize) {
      return err(new Error(`Gene pool is full (${this.maxSize})`));
    }
    this.genes.set(gene.id, gene);
    const speciesSet = this.species.get(gene.type) ?? new Set();
    speciesSet.add(gene.id);
    this.species.set(gene.type, speciesSet);
    return ok(gene);
  }

  removeGene(id: GeneId): Result<boolean> {
    const gene = this.genes.get(id);
    if (!gene) {
      return err(new Error(`Gene ${id} not found`));
    }
    this.genes.delete(id);
    const speciesSet = this.species.get(gene.type);
    if (speciesSet) {
      speciesSet.delete(id);
      if (speciesSet.size === 0) this.species.delete(gene.type);
    }
    return ok(true);
  }

  getGene(id: GeneId): StrategyGene | undefined {
    return this.genes.get(id);
  }

  updateGene(id: GeneId, updates: Partial<Omit<StrategyGene, 'id' | 'createdAt'>>): Result<StrategyGene> {
    const gene = this.genes.get(id);
    if (!gene) {
      return err(new Error(`Gene ${id} not found`));
    }
    const updated: StrategyGene = { ...gene, ...updates, id, createdAt: gene.createdAt };
    this.genes.set(id, updated);
    if (updates.type && updates.type !== gene.type) {
      const oldSet = this.species.get(gene.type);
      if (oldSet) {
        oldSet.delete(id);
        if (oldSet.size === 0) this.species.delete(gene.type);
      }
      const newSet = this.species.get(updated.type) ?? new Set();
      newSet.add(id);
      this.species.set(updated.type, newSet);
    }
    return ok(updated);
  }

  getGenesByType(type: string): StrategyGene[] {
    const ids = this.species.get(type);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.genes.get(id))
      .filter((g): g is StrategyGene => g !== undefined);
  }

  getTopGenes(count: number): StrategyGene[] {
    return Array.from(this.genes.values())
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, count);
  }

  getBottomGenes(count: number): StrategyGene[] {
    return Array.from(this.genes.values())
      .sort((a, b) => a.fitness - b.fitness)
      .slice(0, count);
  }

  getRandomGene(): StrategyGene | undefined {
    if (this.genes.size === 0) return undefined;
    const ids = Array.from(this.genes.keys());
    return this.genes.get(ids[Math.floor(Math.random() * ids.length)]);
  }

  getRandomGenes(count: number): StrategyGene[] {
    const all = Array.from(this.genes.values());
    const result: StrategyGene[] = [];
    for (let i = 0; i < Math.min(count, all.length); i++) {
      const idx = Math.floor(Math.random() * all.length);
      result.push(all[idx]);
    }
    return result;
  }

  getAverageFitness(): number {
    if (this.genes.size === 0) return 0;
    const total = Array.from(this.genes.values()).reduce((sum, g) => sum + g.fitness, 0);
    return total / this.genes.size;
  }

  getBestFitness(): number {
    if (this.genes.size === 0) return 0;
    return Math.max(...Array.from(this.genes.values()).map((g) => g.fitness));
  }

  getWorstFitness(): number {
    if (this.genes.size === 0) return 0;
    return Math.min(...Array.from(this.genes.values()).map((g) => g.fitness));
  }

  getDiversityIndex(): number {
    if (this.genes.size <= 1) return 0;
    const genes = Array.from(this.genes.values());
    let totalDistance = 0;
    let comparisons = 0;
    const sampleSize = Math.min(genes.length, 20);
    const sample = genes.slice(0, sampleSize);
    for (let i = 0; i < sample.length; i++) {
      for (let j = i + 1; j < sample.length; j++) {
        totalDistance += this.geneDistance(sample[i], sample[j]);
        comparisons++;
      }
    }
    return comparisons > 0 ? totalDistance / comparisons : 0;
  }

  private geneDistance(a: StrategyGene, b: StrategyGene): number {
    const aStr = JSON.stringify(a.value);
    const bStr = JSON.stringify(b.value);
    if (aStr === bStr) return 0;
    const maxLen = Math.max(aStr.length, bStr.length);
    if (maxLen === 0) return 0;
    let diff = 0;
    for (let i = 0; i < Math.min(aStr.length, bStr.length); i++) {
      if (aStr[i] !== bStr[i]) diff++;
    }
    diff += Math.abs(aStr.length - bStr.length);
    return diff / maxLen;
  }

  getGeneration(): number {
    return this.generation;
  }

  incrementGeneration(): number {
    return ++this.generation;
  }

  getSize(): number {
    return this.genes.size;
  }

  getAllGenes(): StrategyGene[] {
    return Array.from(this.genes.values());
  }

  getSpeciesCount(): number {
    return this.species.size;
  }

  clear(): void {
    this.genes.clear();
    this.species.clear();
    this.generation = 0;
  }
}
