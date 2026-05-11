import type { HeartbeatStateInternal, CompressedHeartbeat } from "./types.js";
import type { OperationalPhase } from "@paracosm/shared";
import {
  HEART_PHASE_IDLE,
  HEART_PHASE_LIGHT_WORK,
  HEART_PHASE_MEDIUM_WORK,
  HEART_PHASE_HEAVY_WORK,
  HEART_PHASE_SIMULATING,
  HEART_PHASE_DEBATING,
  HEART_PHASE_EVOLVING,
  HEART_PHASE_WAITING,
  HEART_PHASE_ERROR,
  HEART_PHASE_CRITICAL,
  HEART_PHASE_FLATLINE,
  HEART_PHASE_RECOVERING,
  PUSH_INTERVALS,
} from "@paracosm/shared";

type BroadcastCallback = (compressed: CompressedHeartbeat) => void;

interface Subscriber {
  clientId: string;
  callback: BroadcastCallback;
  subscribedAt: string;
  lastSentAt: string | null;
  messagesSent: number;
}

export class HeartbeatBroadcaster {
  private subscribers: Map<string, Subscriber>;
  private lastBroadcastAt: number;
  private broadcastCount: number;
  private totalBytesSent: number;
  private droppedMessages: number;
  private compressionEnabled: boolean;

  constructor() {
    this.subscribers = new Map();
    this.lastBroadcastAt = 0;
    this.broadcastCount = 0;
    this.totalBytesSent = 0;
    this.droppedMessages = 0;
    this.compressionEnabled = true;
  }

  broadcast(state: HeartbeatStateInternal): void {
    const compressed = this.compressPayload(state);
    const now = Date.now();

    for (const [clientId, subscriber] of this.subscribers) {
      try {
        subscriber.callback(compressed);
        subscriber.lastSentAt = new Date().toISOString();
        subscriber.messagesSent++;
      } catch {
        this.droppedMessages++;
      }
    }

    this.lastBroadcastAt = now;
    this.broadcastCount++;

    const estimatedSize = JSON.stringify(compressed).length;
    this.totalBytesSent += estimatedSize * this.subscribers.size;
  }

  subscribe(clientId: string, callback: BroadcastCallback): void {
    this.subscribers.set(clientId, {
      clientId,
      callback,
      subscribedAt: new Date().toISOString(),
      lastSentAt: null,
      messagesSent: 0,
    });
  }

  unsubscribe(clientId: string): void {
    this.subscribers.delete(clientId);
  }

  adaptiveFrequency(phase: OperationalPhase): number {
    const interval = PUSH_INTERVALS[phase as keyof typeof PUSH_INTERVALS];
    if (interval !== undefined) return interval;

    switch (phase) {
      case HEART_PHASE_IDLE as OperationalPhase:
        return 1000;
      case HEART_PHASE_LIGHT_WORK as OperationalPhase:
        return 750;
      case HEART_PHASE_MEDIUM_WORK as OperationalPhase:
        return 500;
      case HEART_PHASE_HEAVY_WORK as OperationalPhase:
        return 500;
      case HEART_PHASE_SIMULATING as OperationalPhase:
        return 500;
      case HEART_PHASE_DEBATING as OperationalPhase:
        return 500;
      case HEART_PHASE_EVOLVING as OperationalPhase:
        return 500;
      case HEART_PHASE_WAITING as OperationalPhase:
        return 1000;
      case HEART_PHASE_ERROR as OperationalPhase:
        return 200;
      case HEART_PHASE_CRITICAL as OperationalPhase:
        return 200;
      case HEART_PHASE_FLATLINE as OperationalPhase:
        return 200;
      case HEART_PHASE_RECOVERING as OperationalPhase:
        return 500;
      default:
        return 1000;
    }
  }

  compressPayload(state: HeartbeatStateInternal): CompressedHeartbeat {
    if (!this.compressionEnabled) {
      return this.createFullPayload(state);
    }

    const waveformValues = state.waveform
      .filter((_, i) => i % 4 === 0)
      .map((p) => Math.round(p.value * 1000) / 1000);

    return {
      ts: new Date(state.lastBeatAt).getTime(),
      ph: state.operationalPhase,
      bpm: state.bpm,
      rh: state.rhythm,
      amp: Math.round(state.amplitude * 1000) / 1000,
      wf: waveformValues,
      err: Math.round(state.vitalSigns.errorRate * 1000) / 1000,
      cpu: Math.round(state.systemMetrics.cpuUsage * 1000) / 1000,
      mem: Math.round(state.systemMetrics.memoryUsage * 1000) / 1000,
      conn: state.systemMetrics.activeConnections,
    };
  }

  private createFullPayload(state: HeartbeatStateInternal): CompressedHeartbeat {
    return {
      ts: new Date(state.lastBeatAt).getTime(),
      ph: state.operationalPhase,
      bpm: state.bpm,
      rh: state.rhythm,
      amp: Math.round(state.amplitude * 1000) / 1000,
      wf: state.waveform.map((p) => Math.round(p.value * 1000) / 1000),
      err: Math.round(state.vitalSigns.errorRate * 1000) / 1000,
      cpu: Math.round(state.systemMetrics.cpuUsage * 1000) / 1000,
      mem: Math.round(state.systemMetrics.memoryUsage * 1000) / 1000,
      conn: state.systemMetrics.activeConnections,
    };
  }

  decompressPayload(compressed: CompressedHeartbeat): Partial<HeartbeatStateInternal> {
    return {
      bpm: compressed.bpm,
      amplitude: compressed.amp,
      operationalPhase: compressed.ph,
      lastBeatAt: new Date(compressed.ts).toISOString(),
      vitalSigns: {
        cpuTemperature: 0,
        memoryPressure: compressed.mem,
        diskHealth: 0,
        networkLatency: 0,
        processCount: 0,
        threadCount: 0,
        openFileDescriptors: 0,
        errorRate: compressed.err,
        responseTime: 0,
        throughput: 0,
      } as any,
      systemMetrics: {
        cpuUsage: compressed.cpu,
        memoryUsage: compressed.mem,
        activeConnections: compressed.conn,
      } as any,
    };
  }

  subscriberCount(): number {
    return this.subscribers.size;
  }

  getSubscriber(clientId: string): Subscriber | undefined {
    return this.subscribers.get(clientId);
  }

  getAllSubscriberIds(): string[] {
    return Array.from(this.subscribers.keys());
  }

  getBroadcastCount(): number {
    return this.broadcastCount;
  }

  getTotalBytesSent(): number {
    return this.totalBytesSent;
  }

  getDroppedMessages(): number {
    return this.droppedMessages;
  }

  getLastBroadcastAt(): number {
    return this.lastBroadcastAt;
  }

  setCompressionEnabled(enabled: boolean): void {
    this.compressionEnabled = enabled;
  }

  isCompressionEnabled(): boolean {
    return this.compressionEnabled;
  }

  getBroadcastStats(): Record<string, unknown> {
    return {
      subscriberCount: this.subscriberCount(),
      broadcastCount: this.broadcastCount,
      totalBytesSent: this.totalBytesSent,
      droppedMessages: this.droppedMessages,
      lastBroadcastAt: this.lastBroadcastAt,
      compressionEnabled: this.compressionEnabled,
    };
  }

  reset(): void {
    this.subscribers.clear();
    this.lastBroadcastAt = 0;
    this.broadcastCount = 0;
    this.totalBytesSent = 0;
    this.droppedMessages = 0;
  }
}
