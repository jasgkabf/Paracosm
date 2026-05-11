import type { OrchestratorEventName, OrchestratorEvent, OrchestratorEventHandler } from "./types.js";

type EventHandler = (...args: unknown[]) => void;

interface PendingWait {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

export class EventBus {
  private handlers: Map<string, Set<EventHandler>>;
  private onceHandlers: Map<string, Set<EventHandler>>;
  private pendingWaits: Map<string, PendingWait[]>;
  private pipelineTransforms: Map<string, { toEvent: string; transform: (data: unknown) => unknown }>;

  constructor() {
    this.handlers = new Map();
    this.onceHandlers = new Map();
    this.pendingWaits = new Map();
    this.pipelineTransforms = new Map();
  }

  emit(event: string, data?: unknown): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch {
          continue;
        }
      }
    }

    const onceHandlers = this.onceHandlers.get(event);
    if (onceHandlers) {
      const handlersToExecute = Array.from(onceHandlers);
      this.onceHandlers.delete(event);
      for (const handler of handlersToExecute) {
        try {
          handler(data);
        } catch {
          continue;
        }
      }
    }

    const waits = this.pendingWaits.get(event);
    if (waits && waits.length > 0) {
      for (const wait of waits) {
        if (wait.timer !== null) {
          clearTimeout(wait.timer);
        }
        wait.resolve(data);
      }
      this.pendingWaits.delete(event);
    }

    const pipeline = this.pipelineTransforms.get(event);
    if (pipeline) {
      try {
        const transformedData = pipeline.transform(data);
        this.emit(pipeline.toEvent, transformedData);
      } catch {
        return;
      }
    }
  }

  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(event);
      }
    }
    const onceHandlers = this.onceHandlers.get(event);
    if (onceHandlers) {
      onceHandlers.delete(handler);
      if (onceHandlers.size === 0) {
        this.onceHandlers.delete(event);
      }
    }
  }

  once(event: string, handler: EventHandler): void {
    if (!this.onceHandlers.has(event)) {
      this.onceHandlers.set(event, new Set());
    }
    this.onceHandlers.get(event)!.add(handler);
  }

  waitFor(event: string, timeout?: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const pending: PendingWait = {
        resolve,
        reject,
        timer: null,
      };

      if (timeout !== undefined && timeout > 0) {
        pending.timer = setTimeout(() => {
          const waits = this.pendingWaits.get(event);
          if (waits) {
            const index = waits.indexOf(pending);
            if (index !== -1) {
              waits.splice(index, 1);
            }
            if (waits.length === 0) {
              this.pendingWaits.delete(event);
            }
          }
          reject(new Error(`Timeout waiting for event "${event}" after ${timeout}ms`));
        }, timeout);
      }

      if (!this.pendingWaits.has(event)) {
        this.pendingWaits.set(event, []);
      }
      this.pendingWaits.get(event)!.push(pending);
    });
  }

  async race(events: string[], timeout?: number): Promise<unknown> {
    if (events.length === 0) {
      throw new Error("Cannot race on empty event list");
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanups: Array<() => void> = [];
      let raceTimer: ReturnType<typeof setTimeout> | null = null;

      const settle = (value: unknown) => {
        if (settled) return;
        settled = true;
        if (raceTimer !== null) {
          clearTimeout(raceTimer);
        }
        for (const cleanup of cleanups) {
          cleanup();
        }
        resolve(value);
      };

      const fail = (reason: unknown) => {
        if (settled) return;
        settled = true;
        if (raceTimer !== null) {
          clearTimeout(raceTimer);
        }
        for (const cleanup of cleanups) {
          cleanup();
        }
        reject(reason);
      };

      for (const event of events) {
        const handler: EventHandler = (data: unknown) => {
          settle(data);
        };
        this.once(event, handler);
        cleanups.push(() => {
          this.off(event, handler);
        });
      }

      if (timeout !== undefined && timeout > 0) {
        raceTimer = setTimeout(() => {
          fail(new Error(`Timeout racing events [${events.join(", ")}] after ${timeout}ms`));
        }, timeout);
      }
    });
  }

  pipeline(fromEvent: string, toEvent: string, transform: (data: unknown) => unknown): void {
    this.pipelineTransforms.set(fromEvent, { toEvent, transform });
  }

  removeAllListeners(event?: string): void {
    if (event !== undefined) {
      this.handlers.delete(event);
      this.onceHandlers.delete(event);
      this.pendingWaits.delete(event);
      this.pipelineTransforms.delete(event);
    } else {
      this.handlers.clear();
      this.onceHandlers.clear();
      this.pendingWaits.clear();
      this.pipelineTransforms.clear();
    }
  }

  listenerCount(event: string): number {
    const handlers = this.handlers.get(event);
    const onceHandlers = this.onceHandlers.get(event);
    return (handlers?.size ?? 0) + (onceHandlers?.size ?? 0);
  }

  eventNames(): string[] {
    const names = new Set<string>();
    for (const key of this.handlers.keys()) {
      names.add(key);
    }
    for (const key of this.onceHandlers.keys()) {
      names.add(key);
    }
    for (const key of this.pendingWaits.keys()) {
      names.add(key);
    }
    for (const key of this.pipelineTransforms.keys()) {
      names.add(key);
    }
    return Array.from(names);
  }
}
