import type { HeartbeatMetrics } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('HeartbeatBroadcaster');

export type HeartbeatListener = (metrics: HeartbeatMetrics) => void;

export class HeartbeatBroadcaster {
  private listeners: Set<HeartbeatListener> = new Set();
  private lastBroadcast: HeartbeatMetrics | null = null;
  private broadcastCount: number = 0;

  subscribe(listener: HeartbeatListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  broadcast(metrics: HeartbeatMetrics): void {
    this.lastBroadcast = metrics;
    this.broadcastCount++;
    for (const listener of this.listeners) {
      try {
        listener(metrics);
      } catch (error) {
        logger.error(`Broadcast listener error: ${error}`);
      }
    }
  }

  getLastBroadcast(): HeartbeatMetrics | null {
    return this.lastBroadcast;
  }

  getListenerCount(): number {
    return this.listeners.size;
  }

  getBroadcastCount(): number {
    return this.broadcastCount;
  }

  clear(): void {
    this.listeners.clear();
    this.lastBroadcast = null;
    this.broadcastCount = 0;
  }
}
