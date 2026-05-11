import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { SimulationError } from "@paracosm/shared";
import { MCTSNode } from "./mcts-node.js";
import { Snapshot } from "./snapshot.js";
import { SimulationPath } from "./path.js";
import type { PathNode } from "./types.js";

export interface MCTSConfig {
  iterations: number;
  explorationParam: number;
  maxDepth: number;
  maxRolloutDepth: number;
  timeLimitMs: number;
  seed: number | null;
  actions: string[];
  earlyStopThreshold: number;
  earlyStopMinVisits: number;
}

const DEFAULT_MCTS_CONFIG: MCTSConfig = {
  iterations: 1000,
  explorationParam: 1.414,
  maxDepth: 20,
  maxRolloutDepth: 10,
  timeLimitMs: 30000,
  seed: null,
  actions: ["create", "update", "delete", "query", "transform", "merge", "split", "validate"],
  earlyStopThreshold: 0.95,
  earlyStopMinVisits: 100,
};

export interface MCTSState {
  snapshot: Snapshot;
  depth: number;
  actionHistory: string[];
  cumulativeReward: number;
}

export class MonteCarloTS {
  private config: MCTSConfig;
  private rng: () => number;
  private iterationCount: number;
  private startTime: number;
  private rewardHistory: number[];

  constructor(config?: Partial<MCTSConfig>) {
    this.config = { ...DEFAULT_MCTS_CONFIG, ...config };
    this.iterationCount = 0;
    this.startTime = 0;
    this.rewardHistory = [];

    if (this.config.seed !== null) {
      let s = this.config.seed;
      this.rng = () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
      };
    } else {
      this.rng = Math.random;
    }
  }

  search(rootState: MCTSState, iterations?: number): Result<MCTSNode, SimulationError> {
    const maxIterations = iterations ?? this.config.iterations;
    this.startTime = Date.now();
    this.iterationCount = 0;
    this.rewardHistory = [];

    const root = MCTSNode.create("root");
    root.setUnexpandedActions([...this.config.actions]);

    for (let i = 0; i < maxIterations; i++) {
      if (this.shouldStop()) break;

      const stateCopy = this.cloneState(rootState);
      const selectedNode = this.selectNode(root);
      const expandedNode = this.expandNode(selectedNode, stateCopy);
      const reward = this.simulateNode(expandedNode, stateCopy);
      this.backpropagate(expandedNode, reward);

      this.iterationCount++;
      this.rewardHistory.push(reward);

      if (this.shouldEarlyStop(root)) break;
    }

    return ok(root);
  }

  selectNode(node: MCTSNode): MCTSNode {
    let current = node;

    while (!current.getIsTerminal()) {
      if (!current.isFullyExpanded()) {
        return current;
      }

      if (current.getChildren().length === 0) {
        return current;
      }

      current = current.bestChild(this.config.explorationParam);
    }

    return current;
  }

  expandNode(node: MCTSNode, state: MCTSState): MCTSNode {
    if (node.getIsTerminal()) return node;
    if (state.depth >= this.config.maxDepth) return node;

    if (!node.isFullyExpanded()) {
      const action = node.getUnexpandedAction();
      if (action === null) return node;

      const parameters = this.generateActionParameters(action, state);
      const child = node.addChild(action, parameters);

      if (this.config.actions.length > 0) {
        child.setUnexpandedActions([...this.config.actions]);
      }

      state.depth++;
      state.actionHistory.push(action);

      const isTerminal = this.isTerminal(state);
      child.setIsTerminal(isTerminal);

      return child;
    }

    return node;
  }

  simulateNode(node: MCTSNode, state: MCTSState): number {
    let currentReward = 0;
    let depth = 0;
    const currentState = this.cloneState(state);

    while (depth < this.config.maxRolloutDepth && !this.isTerminal(currentState)) {
      const action = this.selectRolloutAction(currentState);
      const stepReward = this.computeStepReward(action, currentState);
      currentReward += stepReward * Math.pow(0.99, depth);

      currentState.actionHistory.push(action);
      currentState.depth++;
      currentState.cumulativeReward += stepReward;
      depth++;
    }

    const nodeReward = node.getVisitCount() > 0 ? node.getMeanReward() : 0;
    const blendedReward = nodeReward * 0.3 + currentReward * 0.7;

    return Math.max(0, Math.min(1, blendedReward));
  }

  backpropagate(node: MCTSNode, result: number): void {
    let current: MCTSNode | null = node;
    while (current !== null) {
      current.updateStats(result);
      result *= 0.95;
      current = current.getParent();
    }
  }

  ucb1(node: MCTSNode, explorationParam: number): number {
    const parent = node.getParent();
    if (!parent || node.getVisitCount() === 0) return Infinity;

    const exploitation = node.getMeanReward();
    const exploration = explorationParam * Math.sqrt(
      Math.log(parent.getVisitCount()) / node.getVisitCount()
    );

    return exploitation + exploration;
  }

  isTerminal(state: MCTSState): boolean {
    if (state.depth >= this.config.maxDepth) return true;
    if (state.actionHistory.length >= this.config.maxDepth) return true;
    if (state.cumulativeReward < -1.0) return true;
    return false;
  }

  getBestPath(root: MCTSNode): SimulationPath {
    const path = SimulationPath.create();
    let current: MCTSNode = root;

    while (current.getChildren().length > 0) {
      current = current.mostVisitedChild();
      const entityIds = this.config.actions;

      const stepNode: PathNode = {
        id: `mcts_node_${current.getDepth()}_${Date.now()}`,
        action: current.getAction(),
        parameters: current.getParameters(),
        entityId: entityIds[current.getDepth() % entityIds.length] as any,
        timestamp: new Date().toISOString(),
        stateDelta: { visitCount: current.getVisitCount(), meanReward: current.getMeanReward() },
        cost: 1.0 - current.getMeanReward(),
        risk: 1.0 - current.getMeanReward(),
        duration: 100 * (1 + (1 - current.getMeanReward())),
      };

      path.addStep(stepNode);
    }

    return path;
  }

  getStatistics(): {
    iterations: number;
    elapsedTimeMs: number;
    averageReward: number;
    bestReward: number;
    worstReward: number;
    rewardVariance: number;
  } {
    const elapsed = Date.now() - this.startTime;

    if (this.rewardHistory.length === 0) {
      return {
        iterations: this.iterationCount,
        elapsedTimeMs: elapsed,
        averageReward: 0,
        bestReward: 0,
        worstReward: 0,
        rewardVariance: 0,
      };
    }

    const avg = this.rewardHistory.reduce((s, r) => s + r, 0) / this.rewardHistory.length;
    const best = Math.max(...this.rewardHistory);
    const worst = Math.min(...this.rewardHistory);
    const variance = this.rewardHistory.reduce((s, r) => s + Math.pow(r - avg, 2), 0) / this.rewardHistory.length;

    return {
      iterations: this.iterationCount,
      elapsedTimeMs: elapsed,
      averageReward: avg,
      bestReward: best,
      worstReward: worst,
      rewardVariance: variance,
    };
  }

  getConfig(): MCTSConfig {
    return { ...this.config };
  }

  private shouldStop(): boolean {
    if (Date.now() - this.startTime > this.config.timeLimitMs) return true;
    return false;
  }

  private shouldEarlyStop(root: MCTSNode): boolean {
    if (root.getVisitCount() < this.config.earlyStopMinVisits) return false;

    const bestChild = root.bestRewardChild();
    if (bestChild.getMeanReward() >= this.config.earlyStopThreshold) {
      return bestChild.getVisitCount() >= this.config.earlyStopMinVisits / 2;
    }

    return false;
  }

  private cloneState(state: MCTSState): MCTSState {
    return {
      snapshot: state.snapshot.clone(),
      depth: state.depth,
      actionHistory: [...state.actionHistory],
      cumulativeReward: state.cumulativeReward,
    };
  }

  private generateActionParameters(action: string, state: MCTSState): Record<string, unknown> {
    return {
      action,
      depth: state.depth,
      variant: Math.floor(this.rng() * 10),
      seed: Math.floor(this.rng() * 10000),
    };
  }

  private selectRolloutAction(state: MCTSState): string {
    const recentActions = state.actionHistory.slice(-5);
    const actionCounts = new Map<string, number>();

    for (const action of this.config.actions) {
      actionCounts.set(action, 0);
    }

    for (const action of recentActions) {
      actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1);
    }

    let leastUsed = this.config.actions[0];
    let leastCount = Infinity;
    for (const [action, count] of actionCounts) {
      if (count < leastCount) {
        leastCount = count;
        leastUsed = action;
      }
    }

    if (this.rng() < 0.3) {
      return this.config.actions[Math.floor(this.rng() * this.config.actions.length)];
    }

    return leastUsed;
  }

  private computeStepReward(action: string, state: MCTSState): number {
    let reward = 0.5;

    switch (action) {
      case "create":
        reward = 0.6 + this.rng() * 0.3;
        break;
      case "update":
        reward = 0.5 + this.rng() * 0.4;
        break;
      case "delete":
        reward = 0.3 + this.rng() * 0.3;
        break;
      case "query":
        reward = 0.7 + this.rng() * 0.2;
        break;
      case "transform":
        reward = 0.4 + this.rng() * 0.4;
        break;
      case "merge":
        reward = 0.5 + this.rng() * 0.3;
        break;
      case "split":
        reward = 0.4 + this.rng() * 0.3;
        break;
      case "validate":
        reward = 0.6 + this.rng() * 0.3;
        break;
      default:
        reward = 0.3 + this.rng() * 0.4;
    }

    const depthPenalty = state.depth * 0.02;
    reward -= depthPenalty;

    const repetitionCount = state.actionHistory.filter((a) => a === action).length;
    const repetitionPenalty = Math.min(0.2, repetitionCount * 0.05);
    reward -= repetitionPenalty;

    return Math.max(0, Math.min(1, reward));
  }
}
