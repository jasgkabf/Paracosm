import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import type { PathNode, PathEdge, ScoreWeights } from "./types.js";

export class SimulationPath {
  private id: string;
  private nodes: PathNode[];
  private edges: PathEdge[];
  private probability: number;
  private branchPoint: number | null;
  private parentPathId: string | null;
  private childPathIds: string[];
  private createdAt: string;
  private metadata: Record<string, unknown>;

  private constructor(id: string) {
    this.id = id;
    this.nodes = [];
    this.edges = [];
    this.probability = 1.0;
    this.branchPoint = null;
    this.parentPathId = null;
    this.childPathIds = [];
    this.createdAt = new Date().toISOString();
    this.metadata = {};
  }

  static create(): SimulationPath {
    const id = `path_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return new SimulationPath(id);
  }

  addStep(step: PathNode): void {
    if (this.nodes.length > 0) {
      const previousNode = this.nodes[this.nodes.length - 1];
      const edge: PathEdge = {
        id: `edge_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        sourceNodeId: previousNode.id,
        targetNodeId: step.id,
        probability: 1.0,
        condition: `step_${this.nodes.length}`,
        transitionCost: step.cost,
      };
      this.edges.push(edge);
    }
    this.nodes.push(step);
  }

  evaluate(criteria: ScoreWeights): number {
    if (this.nodes.length === 0) return 0;

    const totalCost = this.getTotalCost();
    const totalRisk = this.getTotalRisk();
    const duration = this.getEstimatedDuration();

    const costFactor = totalCost > 0 ? 1.0 / (1.0 + totalCost) : 1.0;
    const riskFactor = 1.0 - totalRisk;
    const durationFactor = duration > 0 ? 1.0 / (1.0 + duration / 1000) : 1.0;
    const stepFactor = Math.min(1.0, this.nodes.length / 10);

    const score =
      criteria.efficiency * costFactor +
      criteria.risk * riskFactor +
      criteria.feasibility * stepFactor +
      criteria.goalAlignment * this.probability +
      criteria.resourceUtilization * durationFactor +
      criteria.novelty * (1.0 - this.probability) * 0.5 +
      criteria.robustness * (1.0 - totalRisk) * costFactor +
      criteria.constraintSatisfaction * riskFactor;

    return Math.max(0, Math.min(1, score));
  }

  compare(other: SimulationPath): number {
    const thisScore = this.evaluate({
      feasibility: 0.2,
      efficiency: 0.15,
      risk: 0.2,
      goalAlignment: 0.2,
      constraintSatisfaction: 0.1,
      resourceUtilization: 0.05,
      novelty: 0.05,
      robustness: 0.05,
    });

    const otherScore = other.evaluate({
      feasibility: 0.2,
      efficiency: 0.15,
      risk: 0.2,
      goalAlignment: 0.2,
      constraintSatisfaction: 0.1,
      resourceUtilization: 0.05,
      novelty: 0.05,
      robustness: 0.05,
    });

    if (thisScore > otherScore) return 1;
    if (thisScore < otherScore) return -1;
    return 0;
  }

  serialize(): object {
    return {
      id: this.id,
      nodes: this.nodes.map((n) => ({
        id: n.id,
        action: n.action,
        parameters: n.parameters,
        entityId: n.entityId,
        timestamp: n.timestamp,
        stateDelta: n.stateDelta,
        cost: n.cost,
        risk: n.risk,
        duration: n.duration,
      })),
      edges: this.edges.map((e) => ({
        id: e.id,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        probability: e.probability,
        condition: e.condition,
        transitionCost: e.transitionCost,
      })),
      probability: this.probability,
      branchPoint: this.branchPoint,
      parentPathId: this.parentPathId,
      childPathIds: [...this.childPathIds],
      createdAt: this.createdAt,
      metadata: { ...this.metadata },
    };
  }

  getTotalCost(): number {
    let cost = 0;
    for (const node of this.nodes) {
      cost += node.cost;
    }
    for (const edge of this.edges) {
      cost += edge.transitionCost;
    }
    return cost;
  }

  getTotalRisk(): number {
    if (this.nodes.length === 0) return 0;
    let totalRisk = 0;
    for (const node of this.nodes) {
      totalRisk += node.risk;
    }
    return Math.min(1, totalRisk / this.nodes.length);
  }

  getEstimatedDuration(): number {
    let duration = 0;
    for (const node of this.nodes) {
      duration += node.duration;
    }
    return duration;
  }

  getId(): string {
    return this.id;
  }

  getNodes(): PathNode[] {
    return [...this.nodes];
  }

  getEdges(): PathEdge[] {
    return [...this.edges];
  }

  getNodeCount(): number {
    return this.nodes.length;
  }

  getProbability(): number {
    return this.probability;
  }

  setProbability(probability: number): void {
    this.probability = Math.max(0, Math.min(1, probability));
  }

  getBranchPoint(): number | null {
    return this.branchPoint;
  }

  setBranchPoint(step: number | null): void {
    this.branchPoint = step;
  }

  getParentPathId(): string | null {
    return this.parentPathId;
  }

  setParentPathId(id: string | null): void {
    this.parentPathId = id;
  }

  getChildPathIds(): string[] {
    return [...this.childPathIds];
  }

  addChildPathId(id: string): void {
    if (!this.childPathIds.includes(id)) {
      this.childPathIds.push(id);
    }
  }

  getCreatedAt(): string {
    return this.createdAt;
  }

  getMetadata(): Record<string, unknown> {
    return { ...this.metadata };
  }

  setMetadata(key: string, value: unknown): void {
    this.metadata[key] = value;
  }

  getLastNode(): PathNode | null {
    if (this.nodes.length === 0) return null;
    return this.nodes[this.nodes.length - 1];
  }

  getNodeAt(index: number): PathNode | null {
    if (index < 0 || index >= this.nodes.length) return null;
    return this.nodes[index];
  }

  getStepUpTo(stepNumber: number): SimulationPath {
    const newPath = SimulationPath.create();
    newPath.parentPathId = this.id;
    newPath.branchPoint = stepNumber;

    for (let i = 0; i < Math.min(stepNumber + 1, this.nodes.length); i++) {
      newPath.addStep(this.nodes[i]);
    }

    for (let i = 0; i < Math.min(stepNumber, this.edges.length); i++) {
      newPath.edges.push({ ...this.edges[i] });
    }

    let cumulativeProbability = 1.0;
    for (const edge of newPath.edges) {
      cumulativeProbability *= edge.probability;
    }
    newPath.probability = cumulativeProbability;

    this.childPathIds.push(newPath.getId());

    return newPath;
  }

  merge(other: SimulationPath, atStep: number): Result<SimulationPath, ValidationError> {
    if (atStep < 0 || atStep >= this.nodes.length) {
      return err(new ValidationError("Invalid merge step", { atStep, pathLength: this.nodes.length }));
    }

    const merged = SimulationPath.create();
    merged.parentPathId = this.id;

    for (let i = 0; i <= atStep; i++) {
      merged.addStep(this.nodes[i]);
    }

    for (let i = 0; i < Math.min(atStep, this.edges.length); i++) {
      merged.edges.push({ ...this.edges[i] });
    }

    for (const node of other.getNodes()) {
      merged.addStep(node);
    }

    merged.probability = this.probability * other.getProbability() * 0.5;

    return ok(merged);
  }
}
