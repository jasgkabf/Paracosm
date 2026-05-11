import type { ScoreWeights, PathNode } from "./types.js";
import { SimulationPath } from "./path.js";
import { Snapshot } from "./snapshot.js";

export interface ExplorationOptions {
  maxDepth: number;
  maxBreadth: number;
  branchFactor: number;
  pruningThreshold: number;
  explorationRate: number;
  maxPaths: number;
  timeLimitMs: number;
  seed: number | null;
}

const DEFAULT_EXPLORATION_OPTIONS: ExplorationOptions = {
  maxDepth: 10,
  maxBreadth: 5,
  branchFactor: 3,
  pruningThreshold: 0.3,
  explorationRate: 0.2,
  maxPaths: 50,
  timeLimitMs: 30000,
  seed: null,
};

type HeuristicFn = (path: SimulationPath) => number;

export class PathExplorer {
  private options: ExplorationOptions;
  private rng: () => number;
  private exploredCount: number;
  private prunedCount: number;

  constructor(options?: Partial<ExplorationOptions>) {
    this.options = { ...DEFAULT_EXPLORATION_OPTIONS, ...options };
    this.exploredCount = 0;
    this.prunedCount = 0;

    if (this.options.seed !== null) {
      let s = this.options.seed;
      this.rng = () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
      };
    } else {
      this.rng = Math.random;
    }
  }

  explore(snapshot: Snapshot, options?: Partial<ExplorationOptions>): SimulationPath[] {
    const opts = { ...this.options, ...options };
    const startTime = Date.now();
    const paths: SimulationPath[] = [];
    const entityIds = snapshot.getAllEntityIds();

    if (entityIds.length === 0) return paths;

    const initialPath = SimulationPath.create();
    paths.push(initialPath);
    this.exploredCount = 1;

    const queue: SimulationPath[] = [initialPath];

    while (queue.length > 0 && paths.length < opts.maxPaths) {
      if (Date.now() - startTime > opts.timeLimitMs) break;

      const currentPath = queue.shift()!;
      const currentDepth = currentPath.getNodeCount();

      if (currentDepth >= opts.maxDepth) continue;

      const branches = this.generateBranches(currentPath, snapshot, opts);
      const evaluatedBranches = branches.map((p) => ({
        path: p,
        score: this.evaluate(p),
      }));

      const pruned = this.prune(evaluatedBranches.map((b) => b.path), {
        threshold: opts.pruningThreshold,
        maxPaths: opts.maxPaths - paths.length,
      });
      this.prunedCount += evaluatedBranches.length - pruned.length;

      for (const path of pruned) {
        paths.push(path);
        queue.push(path);
        this.exploredCount++;

        if (this.rng() < opts.explorationRate) {
          const randomPath = this.generateRandomBranch(currentPath, snapshot);
          if (randomPath) {
            paths.push(randomPath);
            this.exploredCount++;
          }
        }
      }
    }

    return this.selectBest(paths, Math.min(opts.maxPaths, paths.length));
  }

  branch(path: SimulationPath, step: PathNode): SimulationPath[] {
    const branches: SimulationPath[] = [];
    const branchCount = this.options.branchFactor;

    for (let i = 0; i < branchCount; i++) {
      const branched = SimulationPath.create();
      branched.setParentPathId(path.getId());
      branched.setBranchPoint(path.getNodeCount());

      for (const node of path.getNodes()) {
        branched.addStep(node);
      }

      const variation: PathNode = {
        id: `node_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 8)}`,
        action: step.action,
        parameters: { ...step.parameters, variant: i },
        entityId: step.entityId,
        timestamp: new Date().toISOString(),
        stateDelta: { ...step.stateDelta, branchIndex: i },
        cost: step.cost * (1 + (this.rng() - 0.5) * 0.3),
        risk: Math.min(1, step.risk * (1 + (this.rng() - 0.5) * 0.4)),
        duration: step.duration * (1 + (this.rng() - 0.5) * 0.2),
      };

      branched.addStep(variation);
      branched.setProbability(path.getProbability() * (0.5 + this.rng() * 0.5));

      branches.push(branched);
    }

    return branches;
  }

  prune(paths: SimulationPath[], criteria: { threshold: number; maxPaths: number }): SimulationPath[] {
    if (paths.length <= criteria.maxPaths) return paths;

    const scored = paths.map((p) => ({
      path: p,
      score: this.evaluate(p),
    }));

    scored.sort((a, b) => b.score - a.score);

    const filtered = scored.filter((s) => s.score >= criteria.threshold);
    const result = filtered.length > 0 ? filtered : scored.slice(0, Math.min(criteria.maxPaths, scored.length));

    return result.slice(0, criteria.maxPaths).map((s) => s.path);
  }

  evaluate(path: SimulationPath): number {
    const weights: ScoreWeights = {
      feasibility: 0.2,
      efficiency: 0.15,
      risk: 0.2,
      goalAlignment: 0.2,
      constraintSatisfaction: 0.1,
      resourceUtilization: 0.05,
      novelty: 0.05,
      robustness: 0.05,
    };
    return path.evaluate(weights);
  }

  selectBest(paths: SimulationPath[], n: number): SimulationPath[] {
    const scored = paths.map((p) => ({
      path: p,
      score: this.evaluate(p),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, n).map((s) => s.path);
  }

  depthFirst(snapshot: Snapshot, depth: number): SimulationPath[] {
    const paths: SimulationPath[] = [];
    const entityIds = snapshot.getAllEntityIds();
    if (entityIds.length === 0) return paths;

    const stack: SimulationPath[] = [SimulationPath.create()];
    const visited = new Set<string>();

    while (stack.length > 0 && paths.length < this.options.maxPaths) {
      const current = stack.pop()!;
      const key = this.pathKey(current);

      if (visited.has(key)) continue;
      visited.add(key);

      if (current.getNodeCount() >= depth) {
        paths.push(current);
        continue;
      }

      const branches = this.generateBranches(current, snapshot, {
        ...this.options,
        maxBreadth: this.options.branchFactor,
      });

      for (const branch of branches) {
        stack.push(branch);
      }

      if (branches.length === 0 && current.getNodeCount() > 0) {
        paths.push(current);
      }
    }

    return paths;
  }

  breadthFirst(snapshot: Snapshot, depth: number): SimulationPath[] {
    const paths: SimulationPath[] = [];
    const entityIds = snapshot.getAllEntityIds();
    if (entityIds.length === 0) return paths;

    let currentLevel: SimulationPath[] = [SimulationPath.create()];

    for (let d = 0; d < depth && currentLevel.length > 0; d++) {
      const nextLevel: SimulationPath[] = [];

      for (const path of currentLevel) {
        const branches = this.generateBranches(path, snapshot, {
          ...this.options,
          maxBreadth: this.options.branchFactor,
        });

        if (branches.length === 0) {
          if (path.getNodeCount() > 0) {
            paths.push(path);
          }
        } else {
          nextLevel.push(...branches);
        }
      }

      if (d === depth - 1) {
        paths.push(...nextLevel);
      }

      currentLevel = nextLevel.slice(0, this.options.maxPaths);
    }

    return paths.slice(0, this.options.maxPaths);
  }

  bestFirst(snapshot: Snapshot, heuristic: HeuristicFn, depth: number): SimulationPath[] {
    const paths: SimulationPath[] = [];
    const entityIds = snapshot.getAllEntityIds();
    if (entityIds.length === 0) return paths;

    const openList: Array<{ path: SimulationPath; score: number }> = [];
    const initialPath = SimulationPath.create();
    openList.push({ path: initialPath, score: heuristic(initialPath) });

    const visited = new Set<string>();

    while (openList.length > 0 && paths.length < this.options.maxPaths) {
      openList.sort((a, b) => b.score - a.score);
      const current = openList.shift()!;
      const key = this.pathKey(current.path);

      if (visited.has(key)) continue;
      visited.add(key);

      if (current.path.getNodeCount() >= depth) {
        paths.push(current.path);
        continue;
      }

      const branches = this.generateBranches(current.path, snapshot, {
        ...this.options,
        maxBreadth: this.options.branchFactor,
      });

      for (const branch of branches) {
        const score = heuristic(branch);
        if (score >= this.options.pruningThreshold) {
          openList.push({ path: branch, score });
        }
      }

      if (branches.length === 0 && current.path.getNodeCount() > 0) {
        paths.push(current.path);
      }
    }

    return paths;
  }

  getExploredCount(): number {
    return this.exploredCount;
  }

  getPrunedCount(): number {
    return this.prunedCount;
  }

  private generateBranches(
    path: SimulationPath,
    snapshot: Snapshot,
    opts: ExplorationOptions
  ): SimulationPath[] {
    const branches: SimulationPath[] = [];
    const entityIds = snapshot.getAllEntityIds();
    const branchCount = Math.min(opts.maxBreadth, opts.branchFactor);

    const usedEntities = new Set<string>(path.getNodes().map((n) => n.entityId as string));
    const availableEntities = entityIds.filter((id) => !usedEntities.has(id));

    if (availableEntities.length === 0 && entityIds.length > 0) {
      for (let i = 0; i < Math.min(branchCount, entityIds.length); i++) {
        const entityId = entityIds[Math.floor(this.rng() * entityIds.length)];
        const branch = this.createBranchWithAction(path, entityId, i);
        branches.push(branch);
      }
    } else {
      for (let i = 0; i < Math.min(branchCount, availableEntities.length); i++) {
        const entityId = availableEntities[i];
        const branch = this.createBranchWithAction(path, entityId, i);
        branches.push(branch);
      }
    }

    return branches;
  }

  private createBranchWithAction(path: SimulationPath, entityId: string, variant: number): SimulationPath {
    const branch = SimulationPath.create();
    branch.setParentPathId(path.getId());
    branch.setBranchPoint(path.getNodeCount());

    for (const node of path.getNodes()) {
      branch.addStep(node);
    }

    const actions = ["create", "update", "delete", "query", "transform", "merge", "split", "validate"];
    const action = actions[variant % actions.length];

    const stepNode: PathNode = {
      id: `node_${Date.now()}_${variant}_${Math.random().toString(36).substring(2, 8)}`,
      action,
      parameters: { variant, entityId },
      entityId: entityId as any,
      timestamp: new Date().toISOString(),
      stateDelta: { action, variant },
      cost: 0.1 + this.rng() * 0.5,
      risk: this.rng() * 0.4,
      duration: 100 + this.rng() * 500,
    };

    branch.addStep(stepNode);
    branch.setProbability(path.getProbability() * (0.6 + this.rng() * 0.4));

    return branch;
  }

  private generateRandomBranch(path: SimulationPath, snapshot: Snapshot): SimulationPath | null {
    const entityIds = snapshot.getAllEntityIds();
    if (entityIds.length === 0) return null;

    const entityId = entityIds[Math.floor(this.rng() * entityIds.length)];
    return this.createBranchWithAction(path, entityId, Math.floor(this.rng() * 8));
  }

  private pathKey(path: SimulationPath): string {
    return path.getNodes().map((n) => `${n.entityId}:${n.action}`).join("->");
  }
}
