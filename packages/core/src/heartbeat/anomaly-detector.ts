import type { AnomalyAlert, AnomalyType } from "@paracosm/shared";
import { ANOMALY_THRESHOLDS } from "@paracosm/shared";
import type { HeartbeatStateInternal, HistoryBucket } from "./types.js";

interface AnomalyThresholds {
  tachycardiaBPM: number;
  bradycardiaBPM: number;
  maxVariability: number;
  flatlineTimeoutMs: number;
  cpuCriticalThreshold: number;
  memoryCriticalThreshold: number;
  errorRateCriticalThreshold: number;
  errorRateWarningThreshold: number;
  latencyCriticalMs: number;
  latencyWarningMs: number;
  connectionDropRate: number;
  sustainedHighBpmDurationMs: number;
  sustainedLowBpmDurationMs: number;
}

type AnomalyNotificationCallback = (alert: AnomalyAlert) => void;

export class AnomalyDetector {
  private thresholds: AnomalyThresholds;
  private activeAnomalies: Map<string, AnomalyAlert>;
  private anomalyHistory: AnomalyAlert[];
  private suppressedUntil: Map<string, number>;
  private suppressionDurationMs: number;
  private notificationCallbacks: Set<AnomalyNotificationCallback>;
  private lastCheckAt: string;
  private checkCount: number;
  private maxHistorySize: number;

  constructor(thresholds?: Partial<AnomalyThresholds>) {
    this.thresholds = {
      tachycardiaBPM: ANOMALY_THRESHOLDS.tachycardiaBPM,
      bradycardiaBPM: ANOMALY_THRESHOLDS.bradycardiaBPM,
      maxVariability: ANOMALY_THRESHOLDS.maxVariability,
      flatlineTimeoutMs: ANOMALY_THRESHOLDS.flatlineTimeoutMs,
      cpuCriticalThreshold: 0.9,
      memoryCriticalThreshold: 0.9,
      errorRateCriticalThreshold: 0.5,
      errorRateWarningThreshold: 0.2,
      latencyCriticalMs: 500,
      latencyWarningMs: 200,
      connectionDropRate: 0.5,
      sustainedHighBpmDurationMs: 30000,
      sustainedLowBpmDurationMs: 30000,
      ...thresholds,
    };
    this.activeAnomalies = new Map();
    this.anomalyHistory = [];
    this.suppressedUntil = new Map();
    this.suppressionDurationMs = 60000;
    this.notificationCallbacks = new Set();
    this.lastCheckAt = new Date().toISOString();
    this.checkCount = 0;
    this.maxHistorySize = 10000;
  }

  detect(state: HeartbeatStateInternal): AnomalyAlert[] {
    const alerts: AnomalyAlert[] = [];
    this.checkCount++;
    this.lastCheckAt = new Date().toISOString();

    const flatlineAlert = this.detectFlatline(state.bpm);
    if (flatlineAlert) alerts.push(flatlineAlert);

    const tachycardiaAlert = this.detectTachycardia(state.bpm);
    if (tachycardiaAlert) alerts.push(tachycardiaAlert);

    const bradycardiaAlert = this.detectBradycardia(state.bpm);
    if (bradycardiaAlert) alerts.push(bradycardiaAlert);

    const cpuAlert = this.detectCpuAnomaly(state);
    if (cpuAlert) alerts.push(cpuAlert);

    const memoryAlert = this.detectMemoryAnomaly(state);
    if (memoryAlert) alerts.push(memoryAlert);

    const errorAlert = this.detectErrorAnomaly(state);
    if (errorAlert) alerts.push(errorAlert);

    const latencyAlert = this.detectLatencyAnomaly(state);
    if (latencyAlert) alerts.push(latencyAlert);

    const amplitudeAlert = this.detectAmplitudeAnomaly(state);
    if (amplitudeAlert) alerts.push(amplitudeAlert);

    for (const alert of alerts) {
      this.processAlert(alert);
    }

    return alerts;
  }

  detectArrhythmia(history: HistoryBucket[]): AnomalyAlert | null {
    if (history.length < 5) return null;

    const recentBpms = history.slice(-20).map((b) => b.bpm);
    const avg = recentBpms.reduce((a, b) => a + b, 0) / recentBpms.length;

    const squaredDiffs = recentBpms.map((bpm) => (bpm - avg) ** 2);
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev > this.thresholds.maxVariability) {
      return this.createAlert(
        "oscillation" as AnomalyType,
        "bpm_variability",
        avg,
        stdDev,
        (stdDev - this.thresholds.maxVariability) / this.thresholds.maxVariability,
        `BPM variability ${stdDev.toFixed(1)} exceeds threshold ${this.thresholds.maxVariability}`,
        "high",
        ["heartbeat"]
      );
    }

    const directionChanges: number[] = [];
    for (let i = 1; i < recentBpms.length; i++) {
      directionChanges.push(Math.sign(recentBpms[i] - recentBpms[i - 1]));
    }
    const oscillationCount = directionChanges.filter(
      (d, i) => i > 0 && d !== directionChanges[i - 1] && d !== 0
    ).length;
    const oscillationRate = oscillationCount / Math.max(1, directionChanges.length - 1);

    if (oscillationRate > 0.7) {
      return this.createAlert(
        "oscillation" as AnomalyType,
        "bpm_oscillation",
        avg,
        oscillationRate,
        0.8,
        `BPM oscillation rate ${(oscillationRate * 100).toFixed(1)}% indicates arrhythmia`,
        "medium",
        ["heartbeat"]
      );
    }

    return null;
  }

  detectTachycardia(bpm: number): AnomalyAlert | null {
    if (bpm > this.thresholds.tachycardiaBPM) {
      const deviation = (bpm - this.thresholds.tachycardiaBPM) / this.thresholds.tachycardiaBPM;
      return this.createAlert(
        "spike" as AnomalyType,
        "bpm",
        this.thresholds.tachycardiaBPM,
        bpm,
        deviation,
        `Tachycardia detected: BPM ${bpm} exceeds threshold ${this.thresholds.tachycardiaBPM}`,
        bpm > this.thresholds.tachycardiaBPM * 1.2 ? "critical" : "high",
        ["heartbeat"]
      );
    }
    return null;
  }

  detectBradycardia(bpm: number): AnomalyAlert | null {
    if (bpm > 0 && bpm < this.thresholds.bradycardiaBPM) {
      const deviation = (this.thresholds.bradycardiaBPM - bpm) / this.thresholds.bradycardiaBPM;
      return this.createAlert(
        "drop" as AnomalyType,
        "bpm",
        this.thresholds.bradycardiaBPM,
        bpm,
        deviation,
        `Bradycardia detected: BPM ${bpm} below threshold ${this.thresholds.bradycardiaBPM}`,
        bpm < this.thresholds.bradycardiaBPM * 0.5 ? "critical" : "high",
        ["heartbeat"]
      );
    }
    return null;
  }

  detectFlatline(bpm: number): AnomalyAlert | null {
    if (bpm === 0) {
      return this.createAlert(
        "drop" as AnomalyType,
        "bpm",
        60,
        0,
        1,
        "Flatline detected: BPM is 0, system unresponsive",
        "critical",
        ["heartbeat", "system"]
      );
    }
    return null;
  }

  private detectCpuAnomaly(state: HeartbeatStateInternal): AnomalyAlert | null {
    const cpu = state.systemMetrics.cpuUsage;
    if (cpu > this.thresholds.cpuCriticalThreshold) {
      return this.createAlert(
        "spike" as AnomalyType,
        "cpu_usage",
        this.thresholds.cpuCriticalThreshold,
        cpu,
        (cpu - this.thresholds.cpuCriticalThreshold) / this.thresholds.cpuCriticalThreshold,
        `CPU usage critical: ${(cpu * 100).toFixed(1)}% exceeds ${(this.thresholds.cpuCriticalThreshold * 100).toFixed(0)}%`,
        "critical",
        ["system", "cpu"]
      );
    }
    return null;
  }

  private detectMemoryAnomaly(state: HeartbeatStateInternal): AnomalyAlert | null {
    const mem = state.systemMetrics.memoryUsage;
    if (mem > this.thresholds.memoryCriticalThreshold) {
      return this.createAlert(
        "spike" as AnomalyType,
        "memory_usage",
        this.thresholds.memoryCriticalThreshold,
        mem,
        (mem - this.thresholds.memoryCriticalThreshold) / this.thresholds.memoryCriticalThreshold,
        `Memory usage critical: ${(mem * 100).toFixed(1)}% exceeds ${(this.thresholds.memoryCriticalThreshold * 100).toFixed(0)}%`,
        "critical",
        ["system", "memory"]
      );
    }
    return null;
  }

  private detectErrorAnomaly(state: HeartbeatStateInternal): AnomalyAlert | null {
    const errorRate = state.vitalSigns.errorRate;
    if (errorRate > this.thresholds.errorRateCriticalThreshold) {
      return this.createAlert(
        "spike" as AnomalyType,
        "error_rate",
        this.thresholds.errorRateCriticalThreshold,
        errorRate,
        (errorRate - this.thresholds.errorRateCriticalThreshold) / this.thresholds.errorRateCriticalThreshold,
        `Error rate critical: ${(errorRate * 100).toFixed(1)}% exceeds ${(this.thresholds.errorRateCriticalThreshold * 100).toFixed(0)}%`,
        "critical",
        ["system", "errors"]
      );
    }
    if (errorRate > this.thresholds.errorRateWarningThreshold) {
      return this.createAlert(
        "trend" as AnomalyType,
        "error_rate",
        this.thresholds.errorRateWarningThreshold,
        errorRate,
        (errorRate - this.thresholds.errorRateWarningThreshold) / this.thresholds.errorRateWarningThreshold,
        `Error rate elevated: ${(errorRate * 100).toFixed(1)}% exceeds ${(this.thresholds.errorRateWarningThreshold * 100).toFixed(0)}%`,
        "medium",
        ["system", "errors"]
      );
    }
    return null;
  }

  private detectLatencyAnomaly(state: HeartbeatStateInternal): AnomalyAlert | null {
    const latency = state.vitalSigns.networkLatency;
    if (latency > this.thresholds.latencyCriticalMs) {
      return this.createAlert(
        "spike" as AnomalyType,
        "network_latency",
        this.thresholds.latencyCriticalMs,
        latency,
        (latency - this.thresholds.latencyCriticalMs) / this.thresholds.latencyCriticalMs,
        `Network latency critical: ${latency.toFixed(0)}ms exceeds ${this.thresholds.latencyCriticalMs}ms`,
        "high",
        ["network"]
      );
    }
    if (latency > this.thresholds.latencyWarningMs) {
      return this.createAlert(
        "trend" as AnomalyType,
        "network_latency",
        this.thresholds.latencyWarningMs,
        latency,
        (latency - this.thresholds.latencyWarningMs) / this.thresholds.latencyWarningMs,
        `Network latency elevated: ${latency.toFixed(0)}ms exceeds ${this.thresholds.latencyWarningMs}ms`,
        "medium",
        ["network"]
      );
    }
    return null;
  }

  private detectAmplitudeAnomaly(state: HeartbeatStateInternal): AnomalyAlert | null {
    if (state.amplitude < 0.1 && state.bpm > 0) {
      return this.createAlert(
        "drop" as AnomalyType,
        "amplitude",
        0.3,
        state.amplitude,
        (0.3 - state.amplitude) / 0.3,
        `Waveform amplitude critically low: ${state.amplitude.toFixed(2)} indicates weak signal`,
        "high",
        ["heartbeat", "waveform"]
      );
    }
    return null;
  }

  private createAlert(
    type: AnomalyType,
    metricName: string,
    expectedValue: number,
    actualValue: number,
    deviation: number,
    description: string,
    severity: "low" | "medium" | "high" | "critical",
    affectedComponents: string[]
  ): AnomalyAlert {
    return {
      id: `anom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      metricName,
      expectedValue,
      actualValue,
      deviation: Math.round(deviation * 1000) / 1000,
      confidence: Math.min(1, 0.5 + deviation * 0.5),
      detectedAt: new Date().toISOString(),
      description,
      severity,
      resolvedAt: null,
      remediation: this.suggestRemediation(metricName, severity),
      affectedComponents,
    };
  }

  private suggestRemediation(metricName: string, severity: "low" | "medium" | "high" | "critical"): string {
    switch (metricName) {
      case "bpm":
        if (severity === "critical") return "Investigate system responsiveness immediately";
        return "Monitor workload and consider scaling";
      case "cpu_usage":
        return "Reduce concurrent operations or scale compute resources";
      case "memory_usage":
        return "Free memory caches or increase available memory";
      case "error_rate":
        return "Check error logs and verify service dependencies";
      case "network_latency":
        return "Check network connectivity and server load";
      case "amplitude":
        return "Verify signal source integrity";
      case "bpm_variability":
        return "Stabilize workload distribution";
      default:
        return "Investigate and monitor";
    }
  }

  private processAlert(alert: AnomalyAlert): void {
    const key = `${alert.type}_${alert.metricName}`;
    const now = Date.now();

    const suppressedUntil = this.suppressedUntil.get(key);
    if (suppressedUntil !== undefined && now < suppressedUntil) {
      return;
    }

    const existing = this.activeAnomalies.get(key);
    if (existing) {
      this.resolveAnomaly(key);
    }

    this.activeAnomalies.set(key, alert);
    this.anomalyHistory.push(alert);
    if (this.anomalyHistory.length > this.maxHistorySize) {
      this.anomalyHistory.shift();
    }

    this.suppressedUntil.set(key, now + this.suppressionDurationMs);

    this.notifyAnomaly(alert);
  }

  private resolveAnomaly(key: string): void {
    const alert = this.activeAnomalies.get(key);
    if (alert) {
      alert.resolvedAt = new Date().toISOString();
      this.activeAnomalies.delete(key);
    }
  }

  notifyAnomaly(alert: AnomalyAlert): void {
    for (const callback of this.notificationCallbacks) {
      try {
        callback(alert);
      } catch {
        continue;
      }
    }
  }

  onAnomaly(callback: AnomalyNotificationCallback): void {
    this.notificationCallbacks.add(callback);
  }

  removeAnomalyCallback(callback: AnomalyNotificationCallback): void {
    this.notificationCallbacks.delete(callback);
  }

  getActiveAnomalies(): AnomalyAlert[] {
    return Array.from(this.activeAnomalies.values());
  }

  getAnomalyHistory(limit?: number): AnomalyAlert[] {
    const history = [...this.anomalyHistory];
    return limit !== undefined ? history.slice(-limit) : history;
  }

  getActiveAnomalyCount(): number {
    return this.activeAnomalies.size;
  }

  getCheckCount(): number {
    return this.checkCount;
  }

  getLastCheckAt(): string {
    return this.lastCheckAt;
  }

  updateThresholds(updates: Partial<AnomalyThresholds>): void {
    this.thresholds = { ...this.thresholds, ...updates };
  }

  getThresholds(): AnomalyThresholds {
    return { ...this.thresholds };
  }

  resolveAllAnomalies(): void {
    for (const [key] of this.activeAnomalies) {
      this.resolveAnomaly(key);
    }
  }

  reset(): void {
    this.activeAnomalies.clear();
    this.anomalyHistory = [];
    this.suppressedUntil.clear();
    this.notificationCallbacks.clear();
    this.checkCount = 0;
    this.lastCheckAt = new Date().toISOString();
  }
}
