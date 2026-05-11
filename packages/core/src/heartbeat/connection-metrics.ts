import type { ConnectionEvent } from "./types.js";

interface ConnectionState {
  wsConnections: number;
  httpConcurrent: number;
  wsPingLatencyMs: number;
  totalBytesIn: number;
  totalBytesOut: number;
  connectionErrors: number;
  reconnectCount: number;
  lastPingAt: string;
  lastErrorAt: string | null;
  activeClientIds: Set<string>;
  recentLatencies: number[];
  errorTimestamps: number[];
  connectTimestamps: number[];
  disconnectTimestamps: number[];
}

export class ConnectionMetrics {
  private state: ConnectionState;
  private maxLatencySamples: number;
  private errorWindowMs: number;
  private connectionRateWindowMs: number;

  constructor() {
    this.state = {
      wsConnections: 0,
      httpConcurrent: 0,
      wsPingLatencyMs: 0,
      totalBytesIn: 0,
      totalBytesOut: 0,
      connectionErrors: 0,
      reconnectCount: 0,
      lastPingAt: new Date().toISOString(),
      lastErrorAt: null,
      activeClientIds: new Set(),
      recentLatencies: [],
      errorTimestamps: [],
      connectTimestamps: [],
      disconnectTimestamps: [],
    };
    this.maxLatencySamples = 100;
    this.errorWindowMs = 60000;
    this.connectionRateWindowMs = 60000;
  }

  updateConnection(event: ConnectionEvent): void {
    const now = Date.now();

    switch (event.type) {
      case "connect":
        this.state.wsConnections++;
        if (event.clientId) {
          this.state.activeClientIds.add(event.clientId);
        }
        this.state.connectTimestamps.push(now);
        this.pruneTimestamps(this.state.connectTimestamps, this.connectionRateWindowMs);
        break;

      case "disconnect":
        this.state.wsConnections = Math.max(0, this.state.wsConnections - 1);
        if (event.clientId) {
          this.state.activeClientIds.delete(event.clientId);
        }
        this.state.disconnectTimestamps.push(now);
        this.pruneTimestamps(this.state.disconnectTimestamps, this.connectionRateWindowMs);
        break;

      case "error":
        this.state.connectionErrors++;
        this.state.lastErrorAt = event.timestamp;
        this.state.errorTimestamps.push(now);
        this.pruneTimestamps(this.state.errorTimestamps, this.errorWindowMs);
        break;

      case "ping":
        if (event.latencyMs !== undefined) {
          this.state.wsPingLatencyMs = event.latencyMs;
          this.state.recentLatencies.push(event.latencyMs);
          if (this.state.recentLatencies.length > this.maxLatencySamples) {
            this.state.recentLatencies.shift();
          }
        }
        this.state.lastPingAt = event.timestamp;
        break;

      case "message":
        if (event.bytesIn !== undefined) {
          this.state.totalBytesIn += event.bytesIn;
        }
        if (event.bytesOut !== undefined) {
          this.state.totalBytesOut += event.bytesOut;
        }
        break;

      case "reconnect":
        this.state.reconnectCount++;
        if (event.clientId) {
          this.state.activeClientIds.add(event.clientId);
        }
        break;
    }
  }

  private pruneTimestamps(timestamps: number[], windowMs: number): void {
    const cutoff = Date.now() - windowMs;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }
  }

  wsConnections(): number {
    return this.state.wsConnections;
  }

  httpConcurrent(): number {
    return this.state.httpConcurrent;
  }

  wsPingLatency(): number {
    if (this.state.recentLatencies.length === 0) {
      return this.state.wsPingLatencyMs;
    }
    const sum = this.state.recentLatencies.reduce((a, b) => a + b, 0);
    return sum / this.state.recentLatencies.length;
  }

  wsPingLatencyP95(): number {
    if (this.state.recentLatencies.length === 0) {
      return this.state.wsPingLatencyMs;
    }
    const sorted = [...this.state.recentLatencies].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, index)];
  }

  wsPingLatencyP99(): number {
    if (this.state.recentLatencies.length === 0) {
      return this.state.wsPingLatencyMs;
    }
    const sorted = [...this.state.recentLatencies].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.99) - 1;
    return sorted[Math.max(0, index)];
  }

  bytesIn(): number {
    return this.state.totalBytesIn;
  }

  bytesOut(): number {
    return this.state.totalBytesOut;
  }

  connectionErrors(): number {
    this.pruneTimestamps(this.state.errorTimestamps, this.errorWindowMs);
    return this.state.errorTimestamps.length;
  }

  totalConnectionErrors(): number {
    return this.state.connectionErrors;
  }

  reconnectCount(): number {
    return this.state.reconnectCount;
  }

  connectionRate(): number {
    this.pruneTimestamps(this.state.connectTimestamps, this.connectionRateWindowMs);
    return this.state.connectTimestamps.length;
  }

  disconnectionRate(): number {
    this.pruneTimestamps(this.state.disconnectTimestamps, this.connectionRateWindowMs);
    return this.state.disconnectTimestamps.length;
  }

  activeClientCount(): number {
    return this.state.activeClientIds.size;
  }

  hasActiveConnections(): boolean {
    return this.state.wsConnections > 0 || this.state.httpConcurrent > 0;
  }

  errorRate(): number {
    const totalConnections = this.state.connectTimestamps.length;
    if (totalConnections === 0) return 0;
    this.pruneTimestamps(this.state.errorTimestamps, this.errorWindowMs);
    return Math.min(1, this.state.errorTimestamps.length / totalConnections);
  }

  averageLatency(): number {
    return this.wsPingLatency();
  }

  latencyJitter(): number {
    if (this.state.recentLatencies.length < 2) return 0;
    const avg = this.wsPingLatency();
    const squaredDiffs = this.state.recentLatencies.map((l) => (l - avg) ** 2);
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    return Math.sqrt(variance);
  }

  setHttpConcurrent(count: number): void {
    this.state.httpConcurrent = Math.max(0, count);
  }

  reset(): void {
    this.state = {
      wsConnections: 0,
      httpConcurrent: 0,
      wsPingLatencyMs: 0,
      totalBytesIn: 0,
      totalBytesOut: 0,
      connectionErrors: 0,
      reconnectCount: 0,
      lastPingAt: new Date().toISOString(),
      lastErrorAt: null,
      activeClientIds: new Set(),
      recentLatencies: [],
      errorTimestamps: [],
      connectTimestamps: [],
      disconnectTimestamps: [],
    };
  }

  snapshot(): Record<string, unknown> {
    return {
      wsConnections: this.wsConnections(),
      httpConcurrent: this.httpConcurrent(),
      wsPingLatencyMs: this.wsPingLatency(),
      wsPingLatencyP95: this.wsPingLatencyP95(),
      wsPingLatencyP99: this.wsPingLatencyP99(),
      bytesIn: this.bytesIn(),
      bytesOut: this.bytesOut(),
      connectionErrors: this.connectionErrors(),
      totalConnectionErrors: this.totalConnectionErrors(),
      reconnectCount: this.reconnectCount(),
      connectionRate: this.connectionRate(),
      disconnectionRate: this.disconnectionRate(),
      activeClientCount: this.activeClientCount(),
      errorRate: this.errorRate(),
      latencyJitter: this.latencyJitter(),
    };
  }
}
