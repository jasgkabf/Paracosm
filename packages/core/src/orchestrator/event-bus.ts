import { createLogger } from '@paracosm/shared';

const logger = createLogger('EventBus');

export type EventCallback = (event: string, data: unknown) => void;

export class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private history: Array<{ event: string; data: unknown; timestamp: Date }> = [];
  private maxHistorySize: number;
  private maxListeners: number;

  constructor(maxHistorySize: number = 1000, maxListeners: number = 100) {
    this.maxHistorySize = maxHistorySize;
    this.maxListeners = maxListeners;
  }

  on(event: string, callback: EventCallback): () => void {
    const listeners = this.listeners.get(event) ?? new Set();
    if (listeners.size >= this.maxListeners) {
      logger.warn(`Max listeners (${this.maxListeners}) reached for event: ${event}`);
    }
    listeners.add(callback);
    this.listeners.set(event, listeners);
    return () => {
      const list = this.listeners.get(event);
      if (list) {
        list.delete(callback);
        if (list.size === 0) this.listeners.delete(event);
      }
    };
  }

  once(event: string, callback: EventCallback): () => void {
    const wrapper: EventCallback = (evt, data) => {
      callback(evt, data);
      unsubscribe();
    };
    const unsubscribe = this.on(event, wrapper);
    return unsubscribe;
  }

  emit(event: string, data: unknown): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(event, data);
        } catch (error) {
          logger.error(`Event listener error for ${event}: ${error}`);
        }
      }
    }
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      for (const callback of wildcardListeners) {
        try {
          callback(event, data);
        } catch (error) {
          logger.error(`Wildcard listener error: ${error}`);
        }
      }
    }
    this.history.push({ event, data, timestamp: new Date() });
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  getHistory(event?: string): Array<{ event: string; data: unknown; timestamp: Date }> {
    if (event) {
      return this.history.filter((h) => h.event === event);
    }
    return [...this.history];
  }

  getHistorySince(since: Date): Array<{ event: string; data: unknown; timestamp: Date }> {
    return this.history.filter((h) => h.timestamp >= since);
  }

  getListenerCount(event?: string): number {
    if (event) {
      return this.listeners.get(event)?.size ?? 0;
    }
    let total = 0;
    for (const listeners of this.listeners.values()) {
      total += listeners.size;
    }
    return total;
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  clear(): void {
    this.listeners.clear();
    this.history = [];
  }
}
