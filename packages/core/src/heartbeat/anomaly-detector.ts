import type { AnomalyAlert, HeartbeatMetrics } from '@paracosm/shared';
import { generateId, createLogger } from '@paracosm/shared';
import type { HeartbeatConfig } from './types.js';

const logger = createLogger('AnomalyDetector');

export class AnomalyDetector {
  private config: HeartbeatConfig;
  private recentMetrics: HeartbeatMetrics[] = [];
  private cooldownMs: number;
  private lastAnomalyTime: Map<string, number> = new Map();
  private sensitivity: number;

  constructor(config: HeartbeatConfig, cooldownMs: number = 30000, sensitivity: number = 0.8) {
    this.config = config;
    this.cooldownMs = cooldownMs;
    this.sensitivity = sensitivity;
  }

  detect(metrics: HeartbeatMetrics): AnomalyAlert[] {
    this.recentMetrics.push(metrics);
    if (this.recentMetrics.length > 100) this.recentMetrics.shift();
    const anomalies: AnomalyAlert[] = [];
    const thresholds = this.config.anomalyThresholds;
    if (metrics.systemMetrics) {
      const sys = metrics.systemMetrics as Record<string, unknown>;
      const cpuUsage = sys.cpuUsage as number | undefined;
      if (cpuUsage !== undefined && cpuUsage > thresholds.cpuUsage) {
        anomalies.push(this.createAnomaly('cpu_spike', 'critical', `CPU usage at ${(cpuUsage * 100).toFixed(1)}%`, 'cpuUsage', cpuUsage, thresholds.cpuUsage));
      }
      const memoryUsage = sys.memoryUsage as number | undefined;
      if (memoryUsage !== undefined && memoryUsage > thresholds.memoryUsage) {
        anomalies.push(this.createAnomaly('memory_pressure', 'high', `Memory usage at ${(memoryUsage * 100).toFixed(1)}%`, 'memoryUsage', memoryUsage, thresholds.memoryUsage));
      }
    }
    if (metrics.bpm > 160) {
      anomalies.push(this.createAnomaly('high_latency', 'critical', `BPM at ${metrics.bpm} (tachycardic)`, 'bpm', metrics.bpm, 160));
    } else if (metrics.bpm > 120) {
      anomalies.push(this.createAnomaly('error_rate_spike', 'medium', `BPM elevated at ${metrics.bpm}`, 'bpm', metrics.bpm, 120));
    } else if (metrics.bpm < 50) {
      anomalies.push(this.createAnomaly('stalled_cycle', 'critical', `BPM at ${metrics.bpm} (bradycardic)`, 'bpm', metrics.bpm, 50));
    }
    const filtered = anomalies.filter((a) => {
      const lastTime = this.lastAnomalyTime.get(a.type);
      if (lastTime && Date.now() - lastTime < this.cooldownMs) return false;
      this.lastAnomalyTime.set(a.type, Date.now());
      return true;
    });
    if (filtered.length > 0) {
      logger.warn(`Detected ${filtered.length} anomalies`);
    }
    return filtered;
  }

  private createAnomaly(type: AnomalyAlert['type'], severity: AnomalyAlert['severity'], message: string, metric: string, currentValue: number, threshold: number): AnomalyAlert {
    return {
      id: generateId(),
      type,
      severity,
      message,
      metric,
      currentValue,
      threshold,
      detectedAt: new Date(),
      metadata: {},
    };
  }

  private getRecommendations(type: string): string[] {
    const recommendations: Record<string, string[]> = {
      cpu_usage: ['Reduce concurrent operations', 'Scale horizontally', 'Optimize CPU-intensive tasks'],
      memory_usage: ['Free unused resources', 'Reduce cache sizes', 'Enable memory compression'],
      high_bpm: ['Reduce system load', 'Pause non-critical operations', 'Investigate error sources'],
      low_bpm: ['Check system health', 'Verify heartbeat collection', 'Restart stalled processes'],
      elevated_bpm: ['Monitor closely', 'Prepare for scaling', 'Review recent changes'],
    };
    return recommendations[type] ?? ['Investigate the anomaly', 'Monitor system health'];
  }

  clear(): void {
    this.recentMetrics = [];
    this.lastAnomalyTime.clear();
  }
}
