import { CSEPhase } from '@paracosm/shared';
import type { CSEState } from '@paracosm/shared';
import { ok, err, type Result, createLogger } from '@paracosm/shared';

const logger = createLogger('StateMachine');

interface StateNode {
  phase: CSEPhase;
  transitions: Array<{ target: CSEPhase; condition?: () => boolean; action?: () => void }>;
  onEnter?: () => void;
  onExit?: () => void;
}

export class StateMachine {
  private currentPhase: CSEPhase = CSEPhase.CONSTRUCT;
  private nodes: Map<CSEPhase, StateNode> = new Map();
  private history: Array<{ from: CSEPhase; to: CSEPhase; timestamp: Date }> = [];
  private listeners: Array<(from: CSEPhase, to: CSEPhase) => void> = [];

  constructor() {
    this.initializeStates();
  }

  private initializeStates(): void {
    const phases: CSEPhase[] = [CSEPhase.CONSTRUCT, CSEPhase.SIMULATE, CSEPhase.EXECUTE, CSEPhase.REFLECT, CSEPhase.EVOLVE];
    const nextPhase: Record<string, CSEPhase | null> = {
      [CSEPhase.CONSTRUCT]: CSEPhase.SIMULATE,
      [CSEPhase.SIMULATE]: CSEPhase.EXECUTE,
      [CSEPhase.EXECUTE]: CSEPhase.REFLECT,
      [CSEPhase.REFLECT]: CSEPhase.EVOLVE,
      [CSEPhase.EVOLVE]: CSEPhase.CONSTRUCT,
    };
    for (const phase of phases) {
      const target = nextPhase[phase];
      this.nodes.set(phase, {
        phase,
        transitions: target ? [{ target }] : [],
      });
    }
  }

  getCurrentPhase(): CSEPhase {
    return this.currentPhase;
  }

  transition(target?: CSEPhase): Result<CSEPhase> {
    const currentNode = this.nodes.get(this.currentPhase);
    if (!currentNode) {
      return err(new Error(`No state node for phase: ${this.currentPhase}`));
    }
    let nextPhase: CSEPhase | undefined;
    if (target) {
      const validTransition = currentNode.transitions.some((t) => t.target === target);
      if (!validTransition) {
        return err(new Error(`Invalid transition from ${this.currentPhase} to ${target}`));
      }
      nextPhase = target;
    } else {
      if (currentNode.transitions.length === 0) {
        return err(new Error(`No transitions available from ${this.currentPhase}`));
      }
      nextPhase = currentNode.transitions[0].target;
    }
    if (!nextPhase) {
      return err(new Error('No target phase determined'));
    }
    const from = this.currentPhase;
    if (currentNode.onExit) currentNode.onExit();
    this.currentPhase = nextPhase;
    const nextNode = this.nodes.get(nextPhase);
    if (nextNode?.onEnter) nextNode.onEnter();
    this.history.push({ from, to: nextPhase, timestamp: new Date() });
    for (const listener of this.listeners) {
      try { listener(from, nextPhase); } catch (error) { logger.error(`State transition listener error: ${error}`); }
    }
    logger.info(`State transition: ${from} -> ${nextPhase}`);
    return ok(nextPhase);
  }

  canTransitionTo(target: CSEPhase): boolean {
    const currentNode = this.nodes.get(this.currentPhase);
    if (!currentNode) return false;
    return currentNode.transitions.some((t) => t.target === target);
  }

  getAvailableTransitions(): CSEPhase[] {
    const currentNode = this.nodes.get(this.currentPhase);
    if (!currentNode) return [];
    return currentNode.transitions.map((t) => t.target);
  }

  getHistory(): Array<{ from: CSEPhase; to: CSEPhase; timestamp: Date }> {
    return [...this.history];
  }

  onTransition(listener: (from: CSEPhase, to: CSEPhase) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  reset(): void {
    this.currentPhase = CSEPhase.CONSTRUCT;
    this.history = [];
  }
}
