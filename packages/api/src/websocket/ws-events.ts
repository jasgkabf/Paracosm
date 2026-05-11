import { createLogger } from '@paracosm/shared';

const logger = createLogger('WSEventBus');

export type WSEventType =
  | 'connected'
  | 'disconnected'
  | 'message'
  | 'error'
  | 'heartbeat'
  | 'chat'
  | 'simulation'
  | 'notification'
  | 'world_update'
  | 'persona_message'
  | 'tool_result'
  | 'config_change';

export interface WSEvent {
  type: WSEventType;
  payload: unknown;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export type WSEventHandler = (event: WSEvent) => void;

export class WSEventBus {
  private handlers: Map<WSEventType, WSEventHandler[]> = new Map();
  private globalHandlers: WSEventHandler[] = [];
  private eventHistory: WSEvent[] = [];
  private maxHistorySize: number = 1000;
  private maxHandlersPerEvent: number = 50;

  on(eventType: WSEventType, handler: WSEventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    const handlers = this.handlers.get(eventType)!;
    if (handlers.length >= this.maxHandlersPerEvent) {
      logger.warn('Max handlers reached for event type', { eventType });
      return () => {};
    }

    handlers.push(handler);

    return () => {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) {
        handlers.splice(idx, 1);
      }
    };
  }

  onAny(handler: WSEventHandler): () => void {
    this.globalHandlers.push(handler);
    return () => {
      const idx = this.globalHandlers.indexOf(handler);
      if (idx !== -1) {
        this.globalHandlers.splice(idx, 1);
      }
    };
  }

  emit(event: WSEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }

    const handlers = this.handlers.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        logger.error('Event handler error', {
          eventType: event.type,
          error: (error as Error).message,
        });
      }
    }

    for (const handler of this.globalHandlers) {
      try {
        handler(event);
      } catch (error) {
        logger.error('Global handler error', { error: (error as Error).message });
      }
    }
  }

  off(eventType: WSEventType, handler: WSEventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (!handlers) return;
    const idx = handlers.indexOf(handler);
    if (idx !== -1) {
      handlers.splice(idx, 1);
    }
  }

  getHistory(eventType?: WSEventType, limit?: number): WSEvent[] {
    let events = eventType
      ? this.eventHistory.filter((e) => e.type === eventType)
      : [...this.eventHistory];
    return limit ? events.slice(-limit) : events;
  }

  getHandlerCount(eventType?: WSEventType): number {
    if (eventType) {
      return this.handlers.get(eventType)?.length ?? 0;
    }
    let total = this.globalHandlers.length;
    for (const handlers of this.handlers.values()) {
      total += handlers.length;
    }
    return total;
  }

  clear(): void {
    this.handlers.clear();
    this.globalHandlers = [];
    this.eventHistory = [];
  }
}
