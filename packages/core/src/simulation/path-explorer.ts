import type { SimulationPath, SimulationStep, SimulationSnapshot, SimulationConfig } from '@paracosm/shared';
import { generateId, createLogger } from '@paracosm/shared';
import { createSnapshot } from './snapshot.js';
import { createPath, addStepToPath, computePathProbability, getPathOutcome } from './path.js';

const logger = createLogger('PathExplorer');

export interface ExplorationResult {
  paths: SimulationPath[];
  totalExplored: number;
  pruned: number;
  bestPathId: string;
  worstPathId: string;
  duration: number;
}

export class PathExplorer {
  private config: SimulationConfig;

  constructor(config: SimulationConfig) {
    this.config = config;
  }

  explore(initialState: Record<string, unknown>, transitionFn: (state: Record<string, unknown>) => Array<{ state: Record<string, unknown>; probability: number; transition: string; duration: number }>): ExplorationResult {
    const startTime = Date.now();
    const paths: SimulationPath[] = [];
    let totalExplored = 0;
    let pruned = 0;
    const queue: Array<{
      path: SimulationPath;
      currentState: Record<string, unknown>;
      depth: number;
      cumulativeProbability: number;
    }> = [];

    const initialSnapshot = createSnapshot(initialState);
    const initialPath = createPath('path_0');
    const initialStepPath = addStepToPath(initialPath, initialSnapshot, ['initial'], 0);
    queue.push({
      path: initialStepPath,
      currentState: initialState,
      depth: 0,
      cumulativeProbability: 1.0,
    });

    while (queue.length > 0 && paths.length < this.config.maxPaths) {
      const current = queue.shift()!;
      totalExplored++;
      if (current.depth >= this.config.maxStepsPerPath) {
        const outcome = getPathOutcome(current.path);
        paths.push({ ...current.path, outcome, probability: current.cumulativeProbability });
        continue;
      }
      if (current.cumulativeProbability < this.config.pruningThreshold) {
        pruned++;
        continue;
      }
      const transitions = transitionFn(current.currentState);
      if (transitions.length === 0) {
        const outcome = getPathOutcome(current.path);
        paths.push({ ...current.path, outcome, probability: current.cumulativeProbability });
        continue;
      }
      const limitedTransitions = transitions.slice(0, this.config.branchingFactor);
      for (const transition of limitedTransitions) {
        const snapshot = createSnapshot(transition.state);
        const newPath = addStepToPath(current.path, snapshot, [transition.transition], transition.duration);
        const newProbability = current.cumulativeProbability * transition.probability;
        if (newProbability < this.config.pruningThreshold) {
          pruned++;
          continue;
        }
        queue.push({
          path: newPath,
          currentState: transition.state,
          depth: current.depth + 1,
          cumulativeProbability: newProbability,
        });
      }
    }
    for (const remaining of queue) {
      if (paths.length >= this.config.maxPaths) break;
      const outcome = getPathOutcome(remaining.path);
      paths.push({ ...remaining.path, outcome, probability: remaining.cumulativeProbability });
    }
    paths.sort((a, b) => b.probability - a.probability);
    const bestPathId = paths.length > 0 ? paths[0].id : '';
    const worstPathId = paths.length > 0 ? paths[paths.length - 1].id : '';
    const duration = Date.now() - startTime;
    logger.info(`Path exploration complete: ${paths.length} paths, ${totalExplored} explored, ${pruned} pruned`);
    return { paths, totalExplored, pruned, bestPathId, worstPathId, duration };
  }
}
