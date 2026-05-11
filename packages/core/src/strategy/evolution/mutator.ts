import { GeneType } from "@paracosm/shared";
import { StrategyGene } from "../gene.js";
import type { MutationConfig, GeneInternal } from "../types.js";
import { DEFAULT_MUTATION_CONFIG } from "../types.js";

export interface ParameterMutationSpec {
  field: "priority" | "weight" | "fitness";
  delta: number;
  absolute?: boolean;
}

export class Mutator {
  private config: MutationConfig;
  private mutationCount: number;
  private generationMutations: number;

  constructor(config?: Partial<MutationConfig>) {
    this.config = { ...DEFAULT_MUTATION_CONFIG, ...config };
    this.mutationCount = 0;
    this.generationMutations = 0;
  }

  pointMutate(gene: StrategyGene, rate?: number): StrategyGene {
    const mutationRate = rate ?? this.config.pointRate;
    const mutated = gene.mutate(mutationRate);
    mutated.origin = "mutation";
    this.mutationCount++;
    this.generationMutations++;
    return mutated;
  }

  segmentMutate(gene: StrategyGene, rate?: number): StrategyGene {
    const mutationRate = rate ?? this.config.segmentRate;
    const mutated = gene.clone();
    mutated.origin = "mutation";
    mutated.parentId = gene.id;
    mutated.generation = gene.generation + 1;

    const expression = mutated.expression;

    if (Math.random() < mutationRate && expression.condition.length > 4) {
      const start = Math.floor(Math.random() * (expression.condition.length - 2));
      const length = Math.floor(Math.random() * Math.min(5, expression.condition.length - start));
      const replacement = generateRandomString(length);
      const newCondition = expression.condition.substring(0, start) + replacement + expression.condition.substring(start + length);
      mutated.expression = { ...expression, condition: newCondition };
    }

    if (Math.random() < mutationRate && expression.action.length > 4) {
      const start = Math.floor(Math.random() * (expression.action.length - 2));
      const length = Math.floor(Math.random() * Math.min(5, expression.action.length - start));
      const replacement = generateRandomString(length);
      const newAction = expression.action.substring(0, start) + replacement + expression.action.substring(start + length);
      mutated.expression = { ...mutated.expression, action: newAction };
    }

    this.mutationCount++;
    this.generationMutations++;
    return mutated;
  }

  parameterMutate(gene: StrategyGene, params: ParameterMutationSpec[]): StrategyGene {
    const mutated = gene.clone();
    mutated.origin = "mutation";
    mutated.parentId = gene.id;
    mutated.generation = gene.generation + 1;

    const expression = { ...mutated.expression };

    for (const param of params) {
      if (Math.random() < this.config.parameterRate) {
        switch (param.field) {
          case "priority": {
            const current = expression.priority;
            expression.priority = param.absolute
              ? clamp(param.delta, 0, 1)
              : clamp(current + param.delta, 0, 1);
            break;
          }
          case "weight": {
            const current = expression.weight;
            expression.weight = param.absolute
              ? clamp(param.delta, 0, 1)
              : clamp(current + param.delta, 0, 1);
            break;
          }
          case "fitness": {
            const current = mutated.fitness;
            mutated.fitness = param.absolute
              ? clamp(param.delta, 0, 1)
              : clamp(current + param.delta, 0, 1);
            break;
          }
        }
      }
    }

    mutated.expression = expression;
    this.mutationCount++;
    this.generationMutations++;
    return mutated;
  }

  structureMutate(gene: StrategyGene): StrategyGene {
    const mutated = gene.clone();
    mutated.origin = "mutation";
    mutated.parentId = gene.id;
    mutated.generation = gene.generation + 1;

    const mutationType = Math.random();

    if (mutationType < 0.25) {
      const types = Object.values(GeneType);
      const currentIdx = types.indexOf(mutated.type);
      const offset = Math.random() < 0.5 ? 1 : -1;
      const newIdx = (currentIdx + offset + types.length) % types.length;
      mutated.type = types[newIdx];
    } else if (mutationType < 0.5) {
      const expression = { ...mutated.expression };
      const condition = expression.condition;
      if (condition.length > 2) {
        const insertPos = Math.floor(Math.random() * condition.length);
        const insertStr = generateRandomString(Math.floor(Math.random() * 5) + 1);
        expression.condition = condition.substring(0, insertPos) + insertStr + condition.substring(insertPos);
        mutated.expression = expression;
      }
    } else if (mutationType < 0.75) {
      const expression = { ...mutated.expression };
      const action = expression.action;
      if (action.length > 2) {
        const deletePos = Math.floor(Math.random() * action.length);
        const deleteLen = Math.min(Math.floor(Math.random() * 3) + 1, action.length - deletePos);
        expression.action = action.substring(0, deletePos) + action.substring(deletePos + deleteLen);
        mutated.expression = expression;
      }
    } else {
      const expression = { ...mutated.expression };
      const condition = expression.condition;
      if (condition.length > 3) {
        const start = Math.floor(Math.random() * (condition.length - 2));
        const end = start + Math.floor(Math.random() * Math.min(5, condition.length - start)) + 1;
        const segment = condition.substring(start, end);
        const reversed = segment.split("").reverse().join("");
        expression.condition = condition.substring(0, start) + reversed + condition.substring(end);
        mutated.expression = expression;
      }
    }

    this.mutationCount++;
    this.generationMutations++;
    return mutated;
  }

  adaptiveRate(generation: number, totalGenerations: number): number {
    if (!this.config.adaptiveEnabled) {
      return this.config.pointRate;
    }

    const progress = totalGenerations > 0 ? generation / totalGenerations : 0;
    const baseRate = this.config.pointRate;

    const earlyRate = baseRate * 2;
    const lateRate = baseRate * 0.5;
    const rate = earlyRate + (lateRate - earlyRate) * progress;

    return clamp(rate, this.config.minRate, this.config.maxRate);
  }

  applyMutations(gene: StrategyGene, generation: number, totalGenerations: number): StrategyGene {
    let result = gene;
    const rate = this.adaptiveRate(generation, totalGenerations);

    if (Math.random() < rate) {
      result = this.pointMutate(result, rate);
    }

    if (Math.random() < this.config.segmentRate) {
      result = this.segmentMutate(result, this.config.segmentRate);
    }

    if (Math.random() < this.config.parameterRate) {
      result = this.parameterMutate(result, [
        { field: "priority", delta: (Math.random() - 0.5) * 0.2 },
        { field: "weight", delta: (Math.random() - 0.5) * 0.2 },
      ]);
    }

    if (Math.random() < this.config.structureRate) {
      result = this.structureMutate(result);
    }

    return result;
  }

  resetGenerationCount(): void {
    this.generationMutations = 0;
  }

  getMutationCount(): number {
    return this.mutationCount;
  }

  getGenerationMutations(): number {
    return this.generationMutations;
  }

  setConfig(config: Partial<MutationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): MutationConfig {
    return { ...this.config };
  }
}

function generateRandomString(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_ ";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
