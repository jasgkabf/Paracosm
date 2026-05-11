export interface MCTSNodeData {
  action: string;
  parameters: Record<string, unknown>;
  visitCount: number;
  totalReward: number;
  meanReward: number;
  variance: number;
}

export class MCTSNode {
  private action: string;
  private parameters: Record<string, unknown>;
  private parent: MCTSNode | null;
  private children: MCTSNode[];
  private visitCount: number;
  private totalReward: number;
  private meanReward: number;
  private variance: number;
  private rewardSquaredSum: number;
  private unexpandedActions: string[];
  private isTerminal: boolean;
  private depth: number;

  private constructor(
    action: string,
    parameters: Record<string, unknown>,
    parent: MCTSNode | null,
    depth: number
  ) {
    this.action = action;
    this.parameters = parameters;
    this.parent = parent;
    this.children = [];
    this.visitCount = 0;
    this.totalReward = 0;
    this.meanReward = 0;
    this.variance = 0;
    this.rewardSquaredSum = 0;
    this.unexpandedActions = [];
    this.isTerminal = false;
    this.depth = depth;
  }

  static create(action: string = "root", parameters: Record<string, unknown> = {}, parent: MCTSNode | null = null): MCTSNode {
    const depth = parent ? parent.depth + 1 : 0;
    return new MCTSNode(action, parameters, parent, depth);
  }

  addChild(action: string, parameters: Record<string, unknown> = {}): MCTSNode {
    const child = MCTSNode.create(action, parameters, this);
    this.children.push(child);
    const idx = this.unexpandedActions.indexOf(action);
    if (idx >= 0) {
      this.unexpandedActions.splice(idx, 1);
    }
    return child;
  }

  updateStats(result: number): void {
    this.visitCount++;
    this.totalReward += result;
    this.rewardSquaredSum += result * result;
    this.meanReward = this.totalReward / this.visitCount;

    if (this.visitCount > 1) {
      this.variance =
        (this.rewardSquaredSum / this.visitCount) -
        (this.meanReward * this.meanReward);
    }
  }

  isFullyExpanded(): boolean {
    return this.unexpandedActions.length === 0;
  }

  bestChild(explorationParam: number = 1.414): MCTSNode {
    if (this.children.length === 0) {
      return this;
    }

    let bestNode = this.children[0];
    let bestValue = -Infinity;

    for (const child of this.children) {
      const ucbValue = this.computeUCB1(child, explorationParam);
      if (ucbValue > bestValue) {
        bestValue = ucbValue;
        bestNode = child;
      }
    }

    return bestNode;
  }

  mostVisitedChild(): MCTSNode {
    if (this.children.length === 0) return this;

    let bestChild = this.children[0];
    for (const child of this.children) {
      if (child.visitCount > bestChild.visitCount) {
        bestChild = child;
      }
    }
    return bestChild;
  }

  bestRewardChild(): MCTSNode {
    if (this.children.length === 0) return this;

    let bestChild = this.children[0];
    for (const child of this.children) {
      if (child.meanReward > bestChild.meanReward) {
        bestChild = child;
      }
    }
    return bestChild;
  }

  setUnexpandedActions(actions: string[]): void {
    this.unexpandedActions = [...actions];
  }

  getUnexpandedAction(): string | null {
    if (this.unexpandedActions.length === 0) return null;
    const idx = Math.floor(Math.random() * this.unexpandedActions.length);
    return this.unexpandedActions.splice(idx, 1)[0];
  }

  setIsTerminal(terminal: boolean): void {
    this.isTerminal = terminal;
  }

  getIsTerminal(): boolean {
    return this.isTerminal;
  }

  getAction(): string {
    return this.action;
  }

  getParameters(): Record<string, unknown> {
    return { ...this.parameters };
  }

  getParent(): MCTSNode | null {
    return this.parent;
  }

  getChildren(): MCTSNode[] {
    return [...this.children];
  }

  getVisitCount(): number {
    return this.visitCount;
  }

  getTotalReward(): number {
    return this.totalReward;
  }

  getMeanReward(): number {
    return this.meanReward;
  }

  getVariance(): number {
    return this.variance;
  }

  getDepth(): number {
    return this.depth;
  }

  getChildCount(): number {
    return this.children.length;
  }

  serialize(): object {
    return {
      action: this.action,
      parameters: this.parameters,
      visitCount: this.visitCount,
      totalReward: this.totalReward,
      meanReward: this.meanReward,
      variance: this.variance,
      isTerminal: this.isTerminal,
      depth: this.depth,
      children: this.children.map((c) => c.serialize()),
    };
  }

  getPathFromRoot(): MCTSNode[] {
    const path: MCTSNode[] = [];
    let node: MCTSNode | null = this;
    while (node !== null) {
      path.unshift(node);
      node = node.parent;
    }
    return path;
  }

  getTreeSize(): number {
    let size = 1;
    for (const child of this.children) {
      size += child.getTreeSize();
    }
    return size;
  }

  getMaxDepth(): number {
    if (this.children.length === 0) return this.depth;
    let maxDepth = this.depth;
    for (const child of this.children) {
      maxDepth = Math.max(maxDepth, child.getMaxDepth());
    }
    return maxDepth;
  }

  private computeUCB1(child: MCTSNode, explorationParam: number): number {
    if (child.visitCount === 0) return Infinity;

    const exploitation = child.meanReward;
    const exploration = explorationParam * Math.sqrt(
      Math.log(this.visitCount) / child.visitCount
    );

    return exploitation + exploration;
  }
}
