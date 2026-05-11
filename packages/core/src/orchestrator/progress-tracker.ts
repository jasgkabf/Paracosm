import { CSEPhase } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('ProgressTracker');

export interface ProgressEntry {
  phase: CSEPhase;
  iteration: number;
  step: string;
  progress: number;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export class ProgressTracker {
  private entries: ProgressEntry[] = [];
  private phaseProgress: Map<CSEPhase, number> = new Map();
  private iterationProgress: Map<number, number> = new Map();
  private listeners: Array<(entry: ProgressEntry) => void> = [];

  record(phase: CSEPhase, iteration: number, step: string, progress: number, metadata?: Record<string, unknown>): ProgressEntry {
    const entry: ProgressEntry = {
      phase,
      iteration,
      step,
      progress: Math.min(Math.max(progress, 0), 1),
      timestamp: new Date(),
      metadata: metadata ?? {},
    };
    this.entries.push(entry);
    this.phaseProgress.set(phase, entry.progress);
    const iterKey = iteration;
    const currentIterProgress = this.iterationProgress.get(iterKey) ?? 0;
    this.iterationProgress.set(iterKey, Math.max(currentIterProgress, entry.progress));
    for (const listener of this.listeners) {
      try { listener(entry); } catch (error) { logger.error(`Progress listener error: ${error}`); }
    }
    return entry;
  }

  getPhaseProgress(phase: CSEPhase): number {
    return this.phaseProgress.get(phase) ?? 0;
  }

  getIterationProgress(iteration: number): number {
    return this.iterationProgress.get(iteration) ?? 0;
  }

  getOverallProgress(): number {
    if (this.entries.length === 0) return 0;
    const phases = [CSEPhase.CONSTRUCT, CSEPhase.SIMULATE, CSEPhase.EXECUTE, CSEPhase.REFLECT, CSEPhase.EVOLVE];
    const total = phases.length;
    let completed = 0;
    for (const phase of phases) {
      completed += this.phaseProgress.get(phase) ?? 0;
    }
    return completed / total;
  }

  getHistory(phase?: CSEPhase, iteration?: number): ProgressEntry[] {
    let result = [...this.entries];
    if (phase !== undefined) {
      result = result.filter((e) => e.phase === phase);
    }
    if (iteration !== undefined) {
      result = result.filter((e) => e.iteration === iteration);
    }
    return result;
  }

  onProgress(listener: (entry: ProgressEntry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  clear(): void {
    this.entries = [];
    this.phaseProgress.clear();
    this.iterationProgress.clear();
  }
}
