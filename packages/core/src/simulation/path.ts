import type { SimulationPath, SimulationStep, SimulationSnapshot } from '@paracosm/shared';
import { generateId } from '@paracosm/shared';
import { createSnapshot } from './snapshot.js';

export function createPath(name: string, steps?: SimulationStep[]): SimulationPath {
  return {
    id: generateId(),
    name,
    steps: steps ?? [],
    probability: 1.0,
    outcome: '',
    totalDuration: 0,
    metadata: {},
  };
}

export function addStepToPath(path: SimulationPath, snapshot: SimulationSnapshot, transitions: string[], duration: number): SimulationPath {
  const stepNumber = path.steps.length;
  const step: SimulationStep = {
    stepNumber,
    snapshot,
    duration,
    transitions,
    metadata: {},
  };
  const updatedSteps = [...path.steps, step];
  const totalDuration = updatedSteps.reduce((sum, s) => sum + s.duration, 0);
  return {
    ...path,
    steps: updatedSteps,
    totalDuration,
  };
}

export function computePathProbability(path: SimulationPath, transitionProbabilities: number[]): number {
  if (transitionProbabilities.length === 0) return path.probability;
  let probability = path.probability;
  for (const p of transitionProbabilities) {
    probability *= p;
  }
  return Math.max(probability, 0);
}

export function getPathOutcome(path: SimulationPath): string {
  if (path.steps.length === 0) return 'empty';
  const lastStep = path.steps[path.steps.length - 1];
  const state = lastStep.snapshot.state;
  if (state.status === 'completed' || state.status === 'success') return 'success';
  if (state.status === 'failed' || state.status === 'error') return 'failure';
  if (state.status === 'partial') return 'partial';
  return 'unknown';
}

export function comparePaths(a: SimulationPath, b: SimulationPath): number {
  const aSteps = a.steps.length;
  const bSteps = b.steps.length;
  if (aSteps !== bSteps) return aSteps - bSteps;
  return a.probability - b.probability;
}
