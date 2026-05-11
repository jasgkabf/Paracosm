import { StrategyGene } from "../gene.js";
import type { CrossoverConfig } from "../types.js";
import { DEFAULT_CROSSOVER_CONFIG } from "../types.js";

export class Crossover {
  private config: CrossoverConfig;
  private crossoverCount: number;

  constructor(config?: Partial<CrossoverConfig>) {
    this.config = { ...DEFAULT_CROSSOVER_CONFIG, ...config };
    this.crossoverCount = 0;
  }

  singlePoint(parentA: StrategyGene, parentB: StrategyGene): [StrategyGene, StrategyGene] {
    if (Math.random() > this.config.rate) {
      return [parentA.clone(), parentB.clone()];
    }

    const childA = parentA.clone();
    const childB = parentB.clone();

    childA.origin = "crossover";
    childA.parentId = parentA.id;
    childA.generation = Math.max(parentA.generation, parentB.generation) + 1;

    childB.origin = "crossover";
    childB.parentId = parentB.id;
    childB.generation = childA.generation;

    const exprA = parentA.expression;
    const exprB = parentB.expression;

    const condLen = Math.min(exprA.condition.length, exprB.condition.length);
    if (condLen > 1) {
      const point = Math.floor(Math.random() * (condLen - 1)) + 1;
      const childExprA = { ...childA.expression };
      const childExprB = { ...childB.expression };
      childExprA.condition = exprA.condition.substring(0, point) + exprB.condition.substring(point);
      childExprB.condition = exprB.condition.substring(0, point) + exprA.condition.substring(point);
      childA.expression = childExprA;
      childB.expression = childExprB;
    }

    const actLen = Math.min(exprA.action.length, exprB.action.length);
    if (actLen > 1) {
      const point = Math.floor(Math.random() * (actLen - 1)) + 1;
      const childExprA = { ...childA.expression };
      const childExprB = { ...childB.expression };
      childExprA.action = exprA.action.substring(0, point) + exprB.action.substring(point);
      childExprB.action = exprB.action.substring(0, point) + exprA.action.substring(point);
      childA.expression = childExprA;
      childB.expression = childExprB;
    }

    this.crossoverCount++;
    return [childA, childB];
  }

  twoPoint(parentA: StrategyGene, parentB: StrategyGene): [StrategyGene, StrategyGene] {
    if (Math.random() > this.config.rate) {
      return [parentA.clone(), parentB.clone()];
    }

    const childA = parentA.clone();
    const childB = parentB.clone();

    childA.origin = "crossover";
    childA.parentId = parentA.id;
    childA.generation = Math.max(parentA.generation, parentB.generation) + 1;

    childB.origin = "crossover";
    childB.parentId = parentB.id;
    childB.generation = childA.generation;

    const exprA = parentA.expression;
    const exprB = parentB.expression;

    const condLen = Math.min(exprA.condition.length, exprB.condition.length);
    if (condLen > 2) {
      const point1 = Math.floor(Math.random() * (condLen - 2)) + 1;
      const point2 = Math.floor(Math.random() * (condLen - point1 - 1)) + point1 + 1;
      const childExprA = { ...childA.expression };
      const childExprB = { ...childB.expression };
      childExprA.condition =
        exprA.condition.substring(0, point1) +
        exprB.condition.substring(point1, point2) +
        exprA.condition.substring(point2);
      childExprB.condition =
        exprB.condition.substring(0, point1) +
        exprA.condition.substring(point1, point2) +
        exprB.condition.substring(point2);
      childA.expression = childExprA;
      childB.expression = childExprB;
    }

    const actLen = Math.min(exprA.action.length, exprB.action.length);
    if (actLen > 2) {
      const point1 = Math.floor(Math.random() * (actLen - 2)) + 1;
      const point2 = Math.floor(Math.random() * (actLen - point1 - 1)) + point1 + 1;
      const childExprA = { ...childA.expression };
      const childExprB = { ...childB.expression };
      childExprA.action =
        exprA.action.substring(0, point1) +
        exprB.action.substring(point1, point2) +
        exprA.action.substring(point2);
      childExprB.action =
        exprB.action.substring(0, point1) +
        exprA.action.substring(point1, point2) +
        exprB.action.substring(point2);
      childA.expression = childExprA;
      childB.expression = childExprB;
    }

    this.crossoverCount++;
    return [childA, childB];
  }

  uniform(parentA: StrategyGene, parentB: StrategyGene): [StrategyGene, StrategyGene] {
    if (Math.random() > this.config.rate) {
      return [parentA.clone(), parentB.clone()];
    }

    const childA = parentA.clone();
    const childB = parentB.clone();

    childA.origin = "crossover";
    childA.parentId = parentA.id;
    childA.generation = Math.max(parentA.generation, parentB.generation) + 1;

    childB.origin = "crossover";
    childB.parentId = parentB.id;
    childB.generation = childA.generation;

    const exprA = parentA.expression;
    const exprB = parentB.expression;

    let childCondA = "";
    let childCondB = "";
    const maxCondLen = Math.max(exprA.condition.length, exprB.condition.length);
    for (let i = 0; i < maxCondLen; i++) {
      const charA = i < exprA.condition.length ? exprA.condition[i] : "";
      const charB = i < exprB.condition.length ? exprB.condition[i] : "";
      if (Math.random() < 0.5) {
        childCondA += charA;
        childCondB += charB;
      } else {
        childCondA += charB;
        childCondB += charA;
      }
    }

    let childActA = "";
    let childActB = "";
    const maxActLen = Math.max(exprA.action.length, exprB.action.length);
    for (let i = 0; i < maxActLen; i++) {
      const charA = i < exprA.action.length ? exprA.action[i] : "";
      const charB = i < exprB.action.length ? exprB.action[i] : "";
      if (Math.random() < 0.5) {
        childActA += charA;
        childActB += charB;
      } else {
        childActA += charB;
        childActB += charA;
      }
    }

    childA.expression = { ...childA.expression, condition: childCondA, action: childActA };
    childB.expression = { ...childB.expression, condition: childCondB, action: childActB };

    this.crossoverCount++;
    return [childA, childB];
  }

  blend(parentA: StrategyGene, parentB: StrategyGene, alpha?: number): StrategyGene {
    const blendFactor = alpha ?? this.config.blendAlpha;

    const child = parentA.clone();
    child.origin = "crossover";
    child.parentId = parentA.id;
    child.generation = Math.max(parentA.generation, parentB.generation) + 1;

    const exprA = parentA.expression;
    const exprB = parentB.expression;

    const blendedPriority = exprA.priority * blendFactor + exprB.priority * (1 - blendFactor);
    const blendedWeight = exprA.weight * blendFactor + exprB.weight * (1 - blendFactor);

    child.expression = {
      ...child.expression,
      priority: clamp(blendedPriority, 0, 1),
      weight: clamp(blendedWeight, 0, 1),
    };

    const blendedFitness = parentA.fitness * blendFactor + parentB.fitness * (1 - blendFactor);
    child.fitness = clamp(blendedFitness, 0, 1);

    const combinedApplicability = new Set([...parentA.applicability, ...parentB.applicability]);
    const appArray = Array.from(combinedApplicability);
    const selectedApps = appArray.filter(() => Math.random() < blendFactor + 0.2);
    child.applicability = selectedApps;

    const combinedConstraints = new Set([...parentA.constraints, ...parentB.constraints]);
    const conArray = Array.from(combinedConstraints);
    const selectedCons = conArray.filter(() => Math.random() < blendFactor + 0.2);
    child.constraints = selectedCons;

    const combinedGoals = new Set([...parentA.targetGoals, ...parentB.targetGoals]);
    const goalArray = Array.from(combinedGoals);
    const selectedGoals = goalArray.filter(() => Math.random() < blendFactor + 0.2);
    child.targetGoals = selectedGoals;

    this.crossoverCount++;
    return child;
  }

  ordered(parentA: StrategyGene, parentB: StrategyGene): StrategyGene {
    if (Math.random() > this.config.rate) {
      return parentA.clone();
    }

    const child = parentA.clone();
    child.origin = "crossover";
    child.parentId = parentA.id;
    child.generation = Math.max(parentA.generation, parentB.generation) + 1;

    const appA = parentA.applicability;
    const appB = parentB.applicability;

    if (appA.length > 0 && appB.length > 0) {
      const startPos = Math.floor(Math.random() * appA.length);
      const endPos = Math.floor(Math.random() * appA.length);
      const start = Math.min(startPos, endPos);
      const end = Math.max(startPos, endPos);

      const selectedFromA = appA.slice(start, end + 1);
      const remainingFromB = appB.filter((item) => !selectedFromA.includes(item));
      child.applicability = [...selectedFromA, ...remainingFromB];
    }

    const conA = parentA.constraints;
    const conB = parentB.constraints;

    if (conA.length > 0 && conB.length > 0) {
      const startPos = Math.floor(Math.random() * conA.length);
      const endPos = Math.floor(Math.random() * conA.length);
      const start = Math.min(startPos, endPos);
      const end = Math.max(startPos, endPos);

      const selectedFromA = conA.slice(start, end + 1);
      const remainingFromB = conB.filter((item) => !selectedFromA.includes(item));
      child.constraints = [...selectedFromA, ...remainingFromB];
    }

    this.crossoverCount++;
    return child;
  }

  performCrossover(parentA: StrategyGene, parentB: StrategyGene): StrategyGene[] {
    switch (this.config.method) {
      case "single_point":
        return this.singlePoint(parentA, parentB);
      case "two_point":
        return this.twoPoint(parentA, parentB);
      case "uniform":
        return this.uniform(parentA, parentB);
      case "blend":
        return [this.blend(parentA, parentB)];
      case "ordered":
        return [this.ordered(parentA, parentB)];
      default:
        return this.singlePoint(parentA, parentB);
    }
  }

  getCrossoverCount(): number {
    return this.crossoverCount;
  }

  setConfig(config: Partial<CrossoverConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): CrossoverConfig {
    return { ...this.config };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
