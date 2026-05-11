import type { StrategyGene, MutationOperator } from '@paracosm/shared';
import { generateId, createLogger } from '@paracosm/shared';
import { mutateGeneValue, cloneGene } from '../gene.js';

const logger = createLogger('Mutator');

export class Mutator {
  private operators: Map<string, MutationOperator> = new Map();
  private defaultMutationRate: number;

  constructor(mutationRate: number = 0.1) {
    this.defaultMutationRate = mutationRate;
    this.registerDefaultOperators();
  }

  private registerDefaultOperators(): void {
    const defaultOperators: MutationOperator[] = [
      { id: 'gaussian', name: 'Gaussian Mutation', type: 'gaussian', probability: 0.3, strength: 0.1, domain: 'number', metadata: {} },
      { id: 'uniform', name: 'Uniform Mutation', type: 'uniform', probability: 0.2, strength: 0.2, domain: 'number', metadata: {} },
      { id: 'bitflip', name: 'Bit Flip Mutation', type: 'bitflip', probability: 0.1, strength: 0.5, domain: 'boolean', metadata: {} },
      { id: 'swap', name: 'Swap Mutation', type: 'swap', probability: 0.15, strength: 0.3, domain: 'array', metadata: {} },
      { id: 'insert', name: 'Insert Mutation', type: 'insert', probability: 0.1, strength: 0.2, domain: 'string', metadata: {} },
      { id: 'delete', name: 'Delete Mutation', type: 'delete', probability: 0.05, strength: 0.2, domain: 'string', metadata: {} },
    ];
    for (const op of defaultOperators) {
      this.operators.set(op.id, op);
    }
  }

  registerOperator(operator: MutationOperator): void {
    this.operators.set(operator.id, operator);
  }

  mutate(gene: StrategyGene, operatorId?: string): StrategyGene {
    const operator = operatorId
      ? this.operators.get(operatorId)
      : this.selectOperator(gene);
    if (!operator) {
      return cloneGene(gene);
    }
    if (Math.random() > operator.probability) {
      return cloneGene(gene);
    }
    const mutatedValue = mutateGeneValue(gene.value, operator.type, operator.strength);
    return {
      ...cloneGene(gene),
      value: mutatedValue,
      mutationCount: gene.mutationCount + 1,
      parentIds: [gene.id],
      generation: gene.generation,
    };
  }

  mutatePopulation(genes: StrategyGene[], mutationRate?: number): StrategyGene[] {
    const rate = mutationRate ?? this.defaultMutationRate;
    return genes.map((gene) => {
      if (Math.random() < rate) {
        return this.mutate(gene);
      }
      return cloneGene(gene);
    });
  }

  private selectOperator(gene: StrategyGene): MutationOperator | undefined {
    const compatibleOperators = Array.from(this.operators.values()).filter((op) => {
      if (op.domain === 'number' && typeof gene.value === 'number') return true;
      if (op.domain === 'boolean' && typeof gene.value === 'boolean') return true;
      if (op.domain === 'string' && typeof gene.value === 'string') return true;
      if (op.domain === 'array' && Array.isArray(gene.value)) return true;
      if (op.domain === 'object' && typeof gene.value === 'object' && gene.value !== null && !Array.isArray(gene.value)) return true;
      return false;
    });
    if (compatibleOperators.length === 0) {
      return Array.from(this.operators.values())[0];
    }
    const totalProbability = compatibleOperators.reduce((sum, op) => sum + op.probability, 0);
    let threshold = Math.random() * totalProbability;
    for (const op of compatibleOperators) {
      threshold -= op.probability;
      if (threshold <= 0) return op;
    }
    return compatibleOperators[0];
  }
}
