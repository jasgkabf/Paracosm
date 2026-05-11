import type { SimulationConfig, SimulationPath, SimulationScore } from '@paracosm/shared';
import { generateId, createLogger } from '@paracosm/shared';

const logger = createLogger('MCTSNode');

export interface MCTSNodeData {
  id: string;
  parentId: string | null;
  childrenIds: string[];
  state: Record<string, unknown>;
  visits: number;
  totalReward: number;
  action?: string;
  depth: number;
  untriedActions: string[];
  isTerminal: boolean;
}

export class MCTSNode {
  private data: MCTSNodeData;

  constructor(state: Record<string, unknown>, parentId: string | null = null, action?: string, depth: number = 0, untriedActions: string[] = []) {
    this.data = {
      id: generateId(),
      parentId,
      childrenIds: [],
      state,
      visits: 0,
      totalReward: 0,
      action,
      depth,
      untriedActions: [...untriedActions],
      isTerminal: false,
    };
  }

  getId(): string { return this.data.id; }
  getParentId(): string | null { return this.data.parentId; }
  getChildrenIds(): string[] { return [...this.data.childrenIds]; }
  getState(): Record<string, unknown> { return { ...this.data.state }; }
  getVisits(): number { return this.data.visits; }
  getTotalReward(): number { return this.data.totalReward; }
  getAction(): string | undefined { return this.data.action; }
  getDepth(): number { return this.data.depth; }
  getUntriedActions(): string[] { return [...this.data.untriedActions]; }
  isTerminal(): boolean { return this.data.isTerminal; }

  addChild(childId: string): void {
    this.data.childrenIds.push(childId);
  }

  removeUntriedAction(action: string): void {
    const idx = this.data.untriedActions.indexOf(action);
    if (idx !== -1) this.data.untriedActions.splice(idx, 1);
  }

  update(reward: number): void {
    this.data.visits++;
    this.data.totalReward += reward;
  }

  setTerminal(terminal: boolean): void {
    this.data.isTerminal = terminal;
  }

  getAverageReward(): number {
    return this.data.visits > 0 ? this.data.totalReward / this.data.visits : 0;
  }

  isFullyExpanded(): boolean {
    return this.data.untriedActions.length === 0;
  }

  ucb1(explorationConstant: number = 1.414): number {
    if (this.data.visits === 0) return Infinity;
    const exploitation = this.getAverageReward();
    const parentVisits = this.data.visits;
    const exploration = explorationConstant * Math.sqrt(Math.log(parentVisits) / this.data.visits);
    return exploitation + exploration;
  }
}
