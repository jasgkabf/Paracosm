import type { StateTransition } from "./types.js";

type GuardFn = () => boolean;
type StateHandler = (state: string) => void;

interface TransitionRule {
  from: string;
  to: string;
  guard?: GuardFn;
}

export class StateMachine {
  private currentState: string;
  private transitions: Map<string, Set<string>>;
  private guards: Map<string, GuardFn>;
  private onEnterHandlers: Map<string, Set<StateHandler>>;
  private onExitHandlers: Map<string, Set<StateHandler>>;
  private transitionHistory: StateTransition[];
  private maxHistorySize: number;

  constructor(initialState: string, maxHistorySize: number = 1000) {
    this.currentState = initialState;
    this.transitions = new Map();
    this.guards = new Map();
    this.onEnterHandlers = new Map();
    this.onExitHandlers = new Map();
    this.transitionHistory = [];
    this.maxHistorySize = maxHistorySize;
  }

  addTransition(from: string, to: string): void {
    if (!this.transitions.has(from)) {
      this.transitions.set(from, new Set());
    }
    this.transitions.get(from)!.add(to);
  }

  addTransitions(from: string, toStates: string[]): void {
    for (const to of toStates) {
      this.addTransition(from, to);
    }
  }

  transition(from: string, to: string): boolean {
    if (this.currentState !== from) {
      return false;
    }

    if (!this.validate(from, to)) {
      return false;
    }

    const guardKey = `${from}->${to}`;
    const guardFn = this.guards.get(guardKey);
    if (guardFn) {
      try {
        const guardResult = guardFn();
        this.recordTransition(from, to, guardResult);
        if (!guardResult) {
          return false;
        }
      } catch {
        this.recordTransition(from, to, false);
        return false;
      }
    } else {
      this.recordTransition(from, to, true);
    }

    const exitHandlers = this.onExitHandlers.get(from);
    if (exitHandlers) {
      for (const handler of exitHandlers) {
        try {
          handler(from);
        } catch {
          continue;
        }
      }
    }

    this.currentState = to;

    const enterHandlers = this.onEnterHandlers.get(to);
    if (enterHandlers) {
      for (const handler of enterHandlers) {
        try {
          handler(to);
        } catch {
          continue;
        }
      }
    }

    return true;
  }

  forceTransition(to: string): boolean {
    const from = this.currentState;
    this.recordTransition(from, to, true);

    const exitHandlers = this.onExitHandlers.get(from);
    if (exitHandlers) {
      for (const handler of exitHandlers) {
        try {
          handler(from);
        } catch {
          continue;
        }
      }
    }

    this.currentState = to;

    const enterHandlers = this.onEnterHandlers.get(to);
    if (enterHandlers) {
      for (const handler of enterHandlers) {
        try {
          handler(to);
        } catch {
          continue;
        }
      }
    }

    return true;
  }

  validate(from: string, to: string): boolean {
    const allowedTargets = this.transitions.get(from);
    if (!allowedTargets) {
      return false;
    }
    return allowedTargets.has(to);
  }

  onEnter(state: string, handler: StateHandler): void {
    if (!this.onEnterHandlers.has(state)) {
      this.onEnterHandlers.set(state, new Set());
    }
    this.onEnterHandlers.get(state)!.add(handler);
  }

  onExit(state: string, handler: StateHandler): void {
    if (!this.onExitHandlers.has(state)) {
      this.onExitHandlers.set(state, new Set());
    }
    this.onExitHandlers.get(state)!.add(handler);
  }

  guard(from: string, to: string, guardFn: GuardFn): void {
    const key = `${from}->${to}`;
    this.guards.set(key, guardFn);
    this.addTransition(from, to);
  }

  history(): StateTransition[] {
    return [...this.transitionHistory];
  }

  getCurrentState(): string {
    return this.currentState;
  }

  canTransition(to: string): boolean {
    const allowedTargets = this.transitions.get(this.currentState);
    if (!allowedTargets) {
      return false;
    }
    if (!allowedTargets.has(to)) {
      return false;
    }
    const guardKey = `${this.currentState}->${to}`;
    const guardFn = this.guards.get(guardKey);
    if (guardFn) {
      try {
        return guardFn();
      } catch {
        return false;
      }
    }
    return true;
  }

  getAvailableTransitions(): string[] {
    const allowedTargets = this.transitions.get(this.currentState);
    if (!allowedTargets) {
      return [];
    }
    return Array.from(allowedTargets).filter((target) => this.canTransition(target));
  }

  removeOnEnter(state: string, handler: StateHandler): void {
    const handlers = this.onEnterHandlers.get(state);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.onEnterHandlers.delete(state);
      }
    }
  }

  removeOnExit(state: string, handler: StateHandler): void {
    const handlers = this.onExitHandlers.get(state);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.onExitHandlers.delete(state);
      }
    }
  }

  removeGuard(from: string, to: string): void {
    const key = `${from}->${to}`;
    this.guards.delete(key);
  }

  clearHistory(): void {
    this.transitionHistory = [];
  }

  reset(state: string): void {
    this.currentState = state;
    this.transitionHistory = [];
  }

  private recordTransition(from: string, to: string, guardResult: boolean): void {
    const entry: StateTransition = {
      from,
      to,
      timestamp: new Date().toISOString(),
      guardResult,
      metadata: {},
    };
    this.transitionHistory.push(entry);
    if (this.transitionHistory.length > this.maxHistorySize) {
      this.transitionHistory.shift();
    }
  }
}

export function createCSEStateMachine(): StateMachine {
  const sm = new StateMachine("initialized");

  sm.addTransitions("initialized", ["running"]);
  sm.addTransitions("running", ["paused", "completed", "failed", "cancelled"]);
  sm.addTransitions("paused", ["running", "cancelled"]);
  sm.addTransitions("completed", ["initialized"]);
  sm.addTransitions("failed", ["initialized", "running"]);
  sm.addTransitions("cancelled", ["initialized"]);

  return sm;
}

export function createPhaseStateMachine(): StateMachine {
  const sm = new StateMachine("idle");

  sm.addTransitions("idle", ["construct"]);
  sm.addTransitions("construct", ["simulate", "failed"]);
  sm.addTransitions("simulate", ["execute", "failed"]);
  sm.addTransitions("execute", ["reflect", "failed"]);
  sm.addTransitions("reflect", ["evolve", "failed"]);
  sm.addTransitions("evolve", ["completed", "failed", "construct"]);
  sm.addTransitions("failed", ["idle"]);
  sm.addTransitions("completed", ["idle"]);

  return sm;
}
