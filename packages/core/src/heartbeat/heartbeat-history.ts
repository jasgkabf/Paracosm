import type { HeartbeatMetrics, AnomalyAlert } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('HeartbeatHistory');

export class HeartbeatHistory {
  private entries: HeartbeatMetrics[] = [];
  private maxEntries: number;
  private retentionMs: number;

  constructor(maxEntries: number = 10000, retentionMs: number = 86400000) {
    this.maxEntries = maxEntries;
    this.retentionMs = retentionMs;
  }

  add(metrics: HeartbeatMetrics): void {
    this.entries.push(metrics);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    this.cleanup();
  }

  getRecent(count: number = 10): HeartbeatMetrics[] {
    return this.entries.slice(-count);
  }

  getSince(since: Date): HeartbeatMetrics[] {
    return this.entries.filter((m) => m.timestamp >= since);
  }

  getInRange(start: Date, end: Date): HeartbeatMetrics[] {
    return this.entries.filter((m) => m.timestamp >= start && m.timestamp <= end);
  }

  getAverageBpm(durationMs: number = 300000): number {
    const cutoff = new Date(Date.now() - durationMs);
    const recent = this.getSince(cutoff);
    if (recent.length === 0) return 0;
    return recent.reduce((sum, m) => sum + m.bpm, 0) / recent.length;
  }

  getPeakBpm(durationMs: number = 300000): number {
    const cutoff = new Date(Date.now() - durationMs);
    const recent = this.getSince(cutoff);
    if (recent.length === 0) return 0;
    return Math.max(...recent.map((m) => m.bpm));
  }

  getAnomalies(durationMs: number = 3600000): AnomalyAlert[] {
    const cutoff = new Date(Date.now() - durationMs);
    const recent = this.getSince(cutoff);
    const anomalies: AnomalyAlert[] = [];
    for (const metrics of recent) {
      if (metrics.anomalies) {
        anomalies.push(...metrics.anomalies);
      }
    }
    return anomalies;
  }

  getSize(): number {
    return this.entries.length;
  }

  private cleanup(): void {
    const cutoff = new Date(Date.now() - this.retentionMs);
    while (this.entries.length > 0 && this.entries[0].timestamp < cutoff) {
      this.entries.shift();
    }
  }

  clear(): void {
    this.entries = [];
  }
}
