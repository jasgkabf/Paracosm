import type { StrategyGene, CrossoverOperator } from '@paracosm/shared';
import { generateId, createLogger } from '@paracosm/shared';
import { crossoverValues, cloneGene } from '../gene.js';

const logger = createLogger('Crossover');

export class Crossover {
  private operators: Map<string, CrossoverOperator> = new Map();
  private defaultCrossoverRate: number;

  constructor(crossoverRate: number = 0.7) {
    this.defaultCrossoverRate = crossoverRate;
    this.registerDefaultOperators();
  }

  private registerDefaultOperators(): void {
    const defaults: CrossoverOperator[] = [
      { id: 'single_point', name: 'Single Point Crossover', type: 'single_point', probability: 0.3, metadata: {} },
      { id: 'two_point', name: 'Two Point Crossover', type: 'two_point', probability: 0.25, metadata: {} },
      { id: 'uniform', name: 'Uniform Crossover', type: 'uniform', probability: 0.3, metadata: {} },
      { id: 'blend', name: 'Blend Crossover', type: 'blend', probability: 0.15, metadata: {} },
    ];
    for (const op of defaults) {
      this.operators.set(op.id, op);
    }
  }

  registerOperator(operator: CrossoverOperator): void {
    this.operators.set(operator.id, operator);
  }

  crossover(parentA: StrategyGene, parentB: StrategyGene, operatorId?: string): [StrategyGene, StrategyGene] {
    if (Math.random() > this.defaultCrossoverRate) {
      return [cloneGene(parentA), cloneGene(parentB)];
    }
    const operator = operatorId
      ? this.operators.get(operatorId)
      : this.selectOperator();
    const type = operator?.type ?? 'uniform';
    const [valueA, valueB] = crossoverValues(parentA.value, parentB.value, type as 'single_point' | 'two_point' | 'uniform' | 'blend');
    const childA: StrategyGene = {
      ...cloneGene(parentA),
      value: valueA,
      parentIds: [parentA.id, parentB.id],
      generation: Math.max(parentA.generation, parentB.generation) + 1,
      mutationCount: 0,
    };
    const childB: StrategyGene = {
      ...cloneGene(parentB),
      value: valueB,
      parentIds: [parentA.id, parentB.id],
      generation: Math.max(parentA.generation, parentB.generation) + 1,
      mutationCount: 0,
    };
    return [childA, childB];
  }

  crossoverPopulation(parents: StrategyGene[], crossoverRate?: number): StrategyGene[] {
    const rate = crossoverRate ?? this.defaultCrossoverRate;
    const children: StrategyGene[] = [];
    for (let i = 0; i < parents.length - 1; i += 2) {
      if (Math.random() < rate) {
        const [childA, childB] = this.crossover(parents[i], parents[i + 1]);
        children.push(childA, childB);
      } else {
        children.push(cloneGene(parents[i]), cloneGene(parents[i + 1]));
      }
    }
    if (parents.length % 2 === 1) {
      children.push(cloneGene(parents[parents.length - 1]));
    }
    return children;
  }

  private selectOperator(): CrossoverOperator | undefined {
    const operators = Array.from(this.operators.values());
    if (operators.length === 0) return undefined;
    const totalProbability = operators.reduce((sum, op) => sum + op.probability, 0);
    let threshold = Math.random() * totalProbability;
    for (const op of operators) {
      threshold -= op.probability;
      if (threshold <= 0) return op;
    }
    return operators[0];
  }
}
