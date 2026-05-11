import { GeneType } from "@paracosm/shared";
import { generateId } from "@paracosm/shared";
import type { GeneInternal, GeneExpression } from "./types.js";

export interface GeneCreateParams {
  trigger: string;
  actionTemplate: string;
  evaluation: string;
  fitness?: number;
  name?: string;
  type?: GeneType;
  description?: string;
  applicability?: string[];
  constraints?: string[];
  targetGoals?: string[];
}

export class StrategyGene {
  private data: GeneInternal;

  private constructor(data: GeneInternal) {
    this.data = data;
  }

  static create(params: GeneCreateParams): StrategyGene {
    const now = new Date().toISOString();
    const id = generateId() as unknown as GeneInternal["id"];
    const data: GeneInternal = {
      id,
      name: params.name ?? `gene_${id.substring(0, 8)}`,
      type: params.type ?? GeneType.Heuristic,
      description: params.description ?? `Strategy gene for: ${params.trigger}`,
      expression: {
        condition: params.trigger,
        action: params.actionTemplate,
        priority: 0.5,
        weight: params.fitness ?? 0.5,
      },
      fitness: params.fitness ?? 0.5,
      generation: 0,
      parentId: null,
      origin: "initial",
      active: true,
      applicability: params.applicability ?? [],
      constraints: params.constraints ?? [],
      targetGoals: params.targetGoals ?? [],
      createdAt: now,
      updatedAt: now,
    };
    return new StrategyGene(data);
  }

  get id(): GeneInternal["id"] {
    return this.data.id;
  }

  get name(): string {
    return this.data.name;
  }

  set name(value: string) {
    this.data.name = value;
    this.data.updatedAt = new Date().toISOString();
  }

  get type(): GeneType {
    return this.data.type;
  }

  set type(value: GeneType) {
    this.data.type = value;
    this.data.updatedAt = new Date().toISOString();
  }

  get description(): string {
    return this.data.description;
  }

  set description(value: string) {
    this.data.description = value;
    this.data.updatedAt = new Date().toISOString();
  }

  get expression(): GeneExpression {
    return { ...this.data.expression };
  }

  set expression(value: GeneExpression) {
    this.data.expression = { ...value };
    this.data.updatedAt = new Date().toISOString();
  }

  get fitness(): number {
    return this.data.fitness;
  }

  set fitness(value: number) {
    this.data.fitness = Math.max(0, Math.min(1, value));
    this.data.expression.weight = this.data.fitness;
    this.data.updatedAt = new Date().toISOString();
  }

  get generation(): number {
    return this.data.generation;
  }

  set generation(value: number) {
    this.data.generation = value;
    this.data.updatedAt = new Date().toISOString();
  }

  get parentId(): GeneInternal["parentId"] {
    return this.data.parentId;
  }

  set parentId(value: GeneInternal["parentId"]) {
    this.data.parentId = value;
    this.data.updatedAt = new Date().toISOString();
  }

  get origin(): GeneInternal["origin"] {
    return this.data.origin;
  }

  set origin(value: GeneInternal["origin"]) {
    this.data.origin = value;
    this.data.updatedAt = new Date().toISOString();
  }

  get active(): boolean {
    return this.data.active;
  }

  set active(value: boolean) {
    this.data.active = value;
    this.data.updatedAt = new Date().toISOString();
  }

  get applicability(): string[] {
    return [...this.data.applicability];
  }

  set applicability(value: string[]) {
    this.data.applicability = [...value];
    this.data.updatedAt = new Date().toISOString();
  }

  get constraints(): string[] {
    return [...this.data.constraints];
  }

  set constraints(value: string[]) {
    this.data.constraints = [...value];
    this.data.updatedAt = new Date().toISOString();
  }

  get targetGoals(): string[] {
    return [...this.data.targetGoals];
  }

  set targetGoals(value: string[]) {
    this.data.targetGoals = [...value];
    this.data.updatedAt = new Date().toISOString();
  }

  get createdAt(): string {
    return this.data.createdAt;
  }

  get updatedAt(): string {
    return this.data.updatedAt;
  }

  encode(): string {
    const parts: string[] = [
      this.data.id,
      this.data.type,
      this.data.expression.condition,
      this.data.expression.action,
      this.data.expression.priority.toFixed(6),
      this.data.expression.weight.toFixed(6),
      this.data.fitness.toFixed(6),
      this.data.generation.toString(),
      this.data.origin,
      this.data.active ? "1" : "0",
      this.data.applicability.join(","),
      this.data.constraints.join(","),
      this.data.targetGoals.join(","),
    ];
    return parts.join("|");
  }

  static decode(encoded: string): StrategyGene {
    const parts = encoded.split("|");
    if (parts.length < 13) {
      throw new Error(`Invalid gene encoding: expected at least 13 parts, got ${parts.length}`);
    }
    const now = new Date().toISOString();
    const data: GeneInternal = {
      id: parts[0] as unknown as GeneInternal["id"],
      name: `gene_${parts[0].substring(0, 8)}`,
      type: parts[1] as GeneType,
      description: `Decoded gene: ${parts[2]}`,
      expression: {
        condition: parts[2],
        action: parts[3],
        priority: parseFloat(parts[4]),
        weight: parseFloat(parts[5]),
      },
      fitness: parseFloat(parts[6]),
      generation: parseInt(parts[7], 10),
      parentId: null,
      origin: parts[8] as GeneInternal["origin"],
      active: parts[9] === "1",
      applicability: parts[10] ? parts[10].split(",") : [],
      constraints: parts[11] ? parts[11].split(",") : [],
      targetGoals: parts[12] ? parts[12].split(",") : [],
      createdAt: now,
      updatedAt: now,
    };
    return new StrategyGene(data);
  }

  mutate(rate: number): StrategyGene {
    const mutated = this.clone();
    mutated.data.origin = "mutation";
    mutated.data.parentId = this.data.id;
    mutated.data.generation = this.data.generation + 1;

    if (Math.random() < rate) {
      const condition = mutated.data.expression.condition;
      const pos = Math.floor(Math.random() * condition.length);
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_ ";
      const char = chars[Math.floor(Math.random() * chars.length)];
      mutated.data.expression.condition =
        condition.substring(0, pos) + char + condition.substring(pos + 1);
    }

    if (Math.random() < rate) {
      const action = mutated.data.expression.action;
      const pos = Math.floor(Math.random() * action.length);
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_ ";
      const char = chars[Math.floor(Math.random() * chars.length)];
      mutated.data.expression.action =
        action.substring(0, pos) + char + action.substring(pos + 1);
    }

    if (Math.random() < rate) {
      const delta = (Math.random() - 0.5) * 0.2;
      mutated.data.expression.priority = Math.max(0, Math.min(1, mutated.data.expression.priority + delta));
    }

    if (Math.random() < rate) {
      const delta = (Math.random() - 0.5) * 0.2;
      mutated.data.fitness = Math.max(0, Math.min(1, mutated.data.fitness + delta));
      mutated.data.expression.weight = mutated.data.fitness;
    }

    if (Math.random() < rate * 0.5) {
      const types = Object.values(GeneType);
      const idx = Math.floor(Math.random() * types.length);
      mutated.data.type = types[idx];
    }

    if (Math.random() < rate * 0.3) {
      if (mutated.data.applicability.length > 0 && Math.random() < 0.5) {
        const idx = Math.floor(Math.random() * mutated.data.applicability.length);
        mutated.data.applicability.splice(idx, 1);
      } else {
        mutated.data.applicability.push(`domain_${Math.floor(Math.random() * 100)}`);
      }
    }

    mutated.data.updatedAt = new Date().toISOString();
    return mutated;
  }

  crossover(other: StrategyGene): StrategyGene[] {
    const childA = this.clone();
    const childB = other.clone();

    childA.data.origin = "crossover";
    childA.data.parentId = this.data.id;
    childA.data.generation = Math.max(this.data.generation, other.data.generation) + 1;

    childB.data.origin = "crossover";
    childB.data.parentId = other.data.id;
    childB.data.generation = childA.data.generation;

    const condA = this.data.expression.condition;
    const condB = other.data.expression.condition;
    const minCondLen = Math.min(condA.length, condB.length);
    if (minCondLen > 1) {
      const point = Math.floor(Math.random() * (minCondLen - 1)) + 1;
      childA.data.expression.condition = condA.substring(0, point) + condB.substring(point);
      childB.data.expression.condition = condB.substring(0, point) + condA.substring(point);
    }

    const actA = this.data.expression.action;
    const actB = other.data.expression.action;
    const minActLen = Math.min(actA.length, actB.length);
    if (minActLen > 1) {
      const point = Math.floor(Math.random() * (minActLen - 1)) + 1;
      childA.data.expression.action = actA.substring(0, point) + actB.substring(point);
      childB.data.expression.action = actB.substring(0, point) + actA.substring(point);
    }

    childA.data.expression.priority = (this.data.expression.priority + other.data.expression.priority) / 2;
    childB.data.expression.priority = (this.data.expression.priority + other.data.expression.priority) / 2;

    childA.fitness = (this.data.fitness + other.data.fitness) / 2;
    childB.fitness = (this.data.fitness + other.data.fitness) / 2;

    const combinedApplicability = new Set([...this.data.applicability, ...other.data.applicability]);
    const appArray = Array.from(combinedApplicability);
    const mid = Math.floor(appArray.length / 2);
    childA.data.applicability = appArray.slice(0, mid);
    childB.data.applicability = appArray.slice(mid);

    const combinedConstraints = new Set([...this.data.constraints, ...other.data.constraints]);
    const conArray = Array.from(combinedConstraints);
    const conMid = Math.floor(conArray.length / 2);
    childA.data.constraints = conArray.slice(0, conMid);
    childB.data.constraints = conArray.slice(conMid);

    childA.data.updatedAt = new Date().toISOString();
    childB.data.updatedAt = new Date().toISOString();

    return [childA, childB];
  }

  validate(): boolean {
    if (!this.data.id || this.data.id.length === 0) {
      return false;
    }
    if (!this.data.expression.condition || this.data.expression.condition.length === 0) {
      return false;
    }
    if (!this.data.expression.action || this.data.expression.action.length === 0) {
      return false;
    }
    if (this.data.expression.priority < 0 || this.data.expression.priority > 1) {
      return false;
    }
    if (this.data.expression.weight < 0 || this.data.expression.weight > 1) {
      return false;
    }
    if (this.data.fitness < 0 || this.data.fitness > 1) {
      return false;
    }
    if (this.data.generation < 0) {
      return false;
    }
    if (!Object.values(GeneType).includes(this.data.type)) {
      return false;
    }
    if (!["initial", "mutation", "crossover", "migration"].includes(this.data.origin)) {
      return false;
    }
    return true;
  }

  serialize(): object {
    return {
      id: this.data.id,
      name: this.data.name,
      type: this.data.type,
      description: this.data.description,
      expression: { ...this.data.expression },
      fitness: this.data.fitness,
      generation: this.data.generation,
      parentId: this.data.parentId,
      origin: this.data.origin,
      active: this.data.active,
      applicability: [...this.data.applicability],
      constraints: [...this.data.constraints],
      targetGoals: [...this.data.targetGoals],
      createdAt: this.data.createdAt,
      updatedAt: this.data.updatedAt,
    };
  }

  static fromInternal(data: GeneInternal): StrategyGene {
    return new StrategyGene({ ...data });
  }

  toInternal(): GeneInternal {
    return { ...this.data };
  }

  clone(): StrategyGene {
    const clonedData: GeneInternal = {
      ...this.data,
      id: generateId() as unknown as GeneInternal["id"],
      expression: { ...this.data.expression },
      applicability: [...this.data.applicability],
      constraints: [...this.data.constraints],
      targetGoals: [...this.data.targetGoals],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return new StrategyGene(clonedData);
  }

  similarity(other: StrategyGene): number {
    let score = 0;
    let total = 0;

    if (this.data.type === other.type) {
      score += 1;
    }
    total += 1;

    const condSim = jaccardSimilarity(
      new Set(this.data.expression.condition.split("")),
      new Set(other.expression.condition.split(""))
    );
    score += condSim;
    total += 1;

    const actSim = jaccardSimilarity(
      new Set(this.data.expression.action.split("")),
      new Set(other.expression.action.split(""))
    );
    score += actSim;
    total += 1;

    const appSim = jaccardSimilarity(
      new Set(this.data.applicability),
      new Set(other.applicability)
    );
    score += appSim;
    total += 1;

    return score / total;
  }
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 1;
  }
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}
