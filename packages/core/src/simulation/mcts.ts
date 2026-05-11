import type { SimulationConfig, SimulationPath, SimulationScore, SimulationSnapshot } from '@paracosm/shared';
import { generateId, ok, err, type Result, createLogger } from '@paracosm/shared';
import { MCTSNode } from './mcts-node.js';
import { createSnapshot } from './snapshot.js';
import { createPath, addStepToPath } from './path.js';

const logger = createLogger('MCTS');

export interface MCTSConfig {
  maxIterations: number;
  explorationConstant: number;
  maxDepth: number;
  timeLimitMs: number;
}

export interface MCTSResult {
  bestPath: SimulationPath | null;
  bestScore: number;
  totalIterations: number;
  nodesExplored: number;
  duration: number;
}

const DEFAULT_MCTS_CONFIG: MCTSConfig = {
  maxIterations: 1000,
  explorationConstant: 1.414,
  maxDepth: 20,
  timeLimitMs: 30000,
};

export class MCTS {
  private config: MCTSConfig;
  private nodes: Map<string, MCTSNode> = new Map();
  private rootId: string | null = null;

  constructor(config: Partial<MCTSConfig> = {}) {
    this.config = { ...DEFAULT_MCTS_CONFIG, ...config };
  }

  search(
    initialState: Record<string, unknown>,
    actionGenerator: (state: Record<string, unknown>) => string[],
    transitionFn: (state: Record<string, unknown>, action: string) => { state: Record<string, unknown>; reward: number; terminal: boolean },
    evaluationFn: (state: Record<string, unknown>) => number,
  ): MCTSResult {
    const startTime = Date.now();
    this.nodes.clear();
    const rootActions = actionGenerator(initialState);
    const root = new MCTSNode(initialState, null, undefined, 0, rootActions);
    this.rootId = root.getId();
    this.nodes.set(root.getId(), root);
    let iterations = 0;
    while (iterations < this.config.maxIterations) {
      if (Date.now() - startTime > this.config.timeLimitMs) break;
      const leafId = this.select();
      if (!leafId) break;
      const leaf = this.nodes.get(leafId)!;
      let nodeId: string;
      if (leaf.getVisits() === 0 && leaf.getId() !== this.rootId) {
        nodeId = leafId;
      } else if (!leaf.isTerminal()) {
        nodeId = this.expand(leafId, actionGenerator, transitionFn) ?? leafId;
      } else {
        nodeId = leafId;
      }
      const reward = this.simulate(nodeId, transitionFn, evaluationFn);
      this.backpropagate(nodeId, reward);
      iterations++;
    }
    const bestPath = this.extractBestPath(transitionFn);
    const bestScore = this.rootId ? (this.nodes.get(this.rootId)?.getAverageReward() ?? 0) : 0;
    const duration = Date.now() - startTime;
    logger.info(`MCTS search complete: ${iterations} iterations, ${this.nodes.size} nodes, ${duration}ms`);
    return {
      bestPath,
      bestScore,
      totalIterations: iterations,
      nodesExplored: this.nodes.size,
      duration,
    };
  }

  private select(): string | null {
    let currentId = this.rootId;
    if (!currentId) return null;
    while (true) {
      const node = this.nodes.get(currentId);
      if (!node) return currentId;
      if (node.isTerminal()) return currentId;
      if (!node.isFullyExpanded()) return currentId;
      const children = node.getChildrenIds();
      if (children.length === 0) return currentId;
      let bestChildId = children[0];
      let bestUcb = -Infinity;
      for (const childId of children) {
        const child = this.nodes.get(childId);
        if (child) {
          const ucb = child.ucb1(this.config.explorationConstant);
          if (ucb > bestUcb) {
            bestUcb = ucb;
            bestChildId = childId;
          }
        }
      }
      currentId = bestChildId;
    }
  }

  private expand(
    nodeId: string,
    actionGenerator: (state: Record<string, unknown>) => string[],
    transitionFn: (state: Record<string, unknown>, action: string) => { state: Record<string, unknown>; reward: number; terminal: boolean },
  ): string | null {
    const node = this.nodes.get(nodeId);
    if (!node || node.isTerminal()) return null;
    const untried = node.getUntriedActions();
    if (untried.length === 0) return null;
    const action = untried[Math.floor(Math.random() * untried.length)];
    node.removeUntriedAction(action);
    const result = transitionFn(node.getState(), action);
    const childActions = actionGenerator(result.state);
    const child = new MCTSNode(result.state, nodeId, action, node.getDepth() + 1, childActions);
    child.setTerminal(result.terminal || node.getDepth() + 1 >= this.config.maxDepth);
    this.nodes.set(child.getId(), child);
    node.addChild(child.getId());
    return child.getId();
  }

  private simulate(
    nodeId: string,
    transitionFn: (state: Record<string, unknown>, action: string) => { state: Record<string, unknown>; reward: number; terminal: boolean },
    evaluationFn: (state: Record<string, unknown>) => number,
  ): number {
    const node = this.nodes.get(nodeId);
    if (!node) return 0;
    let state = node.getState();
    let totalReward = 0;
    let depth = 0;
    while (depth < this.config.maxDepth) {
      const evaluation = evaluationFn(state);
      if (evaluation >= 0.9 || evaluation <= 0.1) {
        totalReward += evaluation;
        break;
      }
      const actions = Object.keys(state).map((k) => `action_${k}`);
      if (actions.length === 0) break;
      const action = actions[Math.floor(Math.random() * actions.length)];
      const result = transitionFn(state, action);
      totalReward += result.reward;
      state = result.state;
      if (result.terminal) break;
      depth++;
    }
    return totalReward / (depth + 1);
  }

  private backpropagate(nodeId: string, reward: number): void {
    let currentId: string | null = nodeId;
    while (currentId) {
      const node = this.nodes.get(currentId);
      if (!node) break;
      node.update(reward);
      currentId = node.getParentId();
    }
  }

  private extractBestPath(transitionFn: (state: Record<string, unknown>, action: string) => { state: Record<string, unknown>; reward: number; terminal: boolean }): SimulationPath | null {
    if (!this.rootId) return null;
    let path = createPath('mcts_best');
    let currentId: string | null = this.rootId;
    const root = this.nodes.get(this.rootId);
    if (root) {
      const snapshot = createSnapshot(root.getState());
      path = addStepToPath(path, snapshot, ['initial'], 0);
    }
    while (currentId) {
      const node = this.nodes.get(currentId);
      if (!node) break;
      const children = node.getChildrenIds();
      if (children.length === 0) break;
      let bestChildId = children[0];
      let bestVisits = 0;
      for (const childId of children) {
        const child = this.nodes.get(childId);
        if (child && child.getVisits() > bestVisits) {
          bestVisits = child.getVisits();
          bestChildId = childId;
        }
      }
      const bestChild = this.nodes.get(bestChildId);
      if (bestChild) {
        const snapshot = createSnapshot(bestChild.getState());
        path = addStepToPath(path, snapshot, [bestChild.getAction() ?? 'unknown'], 100);
        currentId = bestChildId;
      } else {
        break;
      }
    }
    return path;
  }

  clear(): void {
    this.nodes.clear();
    this.rootId = null;
  }
}
