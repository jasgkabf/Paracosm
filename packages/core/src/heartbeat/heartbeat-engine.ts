import { RhythmType } from "@paracosm/shared";
import type { HeartPhase, AnomalyAlert } from "@paracosm/shared";
import {
  HEART_PHASE_IDLE,
  HEART_PHASE_FLATLINE,
  HEART_PHASE_ERROR,
  PUSH_INTERVALS,
  PHASE_TRANSITION_COOLDOWN_MS,
} from "@paracosm/shared";
import type { OperationalPhase } from "@paracosm/shared";
import type {
  HeartbeatConfig,
  HeartbeatStateInternal,
  HeartbeatCallback,
  HeartbeatEventName,
  HeartbeatEventHandler,
} from "./types.js";
import { DEFAULT_HEARTBEAT_CONFIG } from "./types.js";
import { VitalSignsCollector } from "./vital-signs-collector.js";
import { HeartbeatCalculator } from "./heartbeat-calculator.js";
import { WaveformGenerator } from "./waveform-generator.js";
import { HeartbeatBroadcaster } from "./heartbeat-broadcaster.js";
import { HeartbeatHistory } from "./heartbeat-history.js";
import { AnomalyDetector } from "./anomaly-detector.js";

export class HeartbeatEngine {
  private config: HeartbeatConfig;
  private vitalSignsCollector: VitalSignsCollector;
  private calculator: HeartbeatCalculator;
  private waveformGenerator: WaveformGenerator;
  private broadcaster: HeartbeatBroadcaster;
  private history: HeartbeatHistory;
  private anomalyDetector: AnomalyDetector;

  private running: boolean;
  private initialized: boolean;
  private loopTimer: ReturnType<typeof setInterval> | null;
  private currentState: HeartbeatStateInternal | null;
  private startTime: number;
  private beatCount: number;
  private lastBeatAt: number;
  private lastPhaseChangeAt: number;

  private beatCallbacks: Set<HeartbeatCallback>;
  private phaseChangeCallbacks: Set<HeartbeatCallback>;
  private anomalyCallbacks: Set<(alert: AnomalyAlert) => void>;
  private eventHandlers: Map<HeartbeatEventName, Set<HeartbeatEventHandler>>;

  constructor(config?: Partial<HeartbeatConfig>) {
    this.config = { ...DEFAULT_HEARTBEAT_CONFIG, ...config };
    this.vitalSignsCollector = new VitalSignsCollector();
    this.calculator = new HeartbeatCalculator();
    this.waveformGenerator = new WaveformGenerator();
    this.broadcaster = new HeartbeatBroadcaster();
    this.history = new HeartbeatHistory();
    this.anomalyDetector = new AnomalyDetector();

    this.running = false;
    this.initialized = false;
    this.loopTimer = null;
    this.currentState = null;
    this.startTime = Date.now();
    this.beatCount = 0;
    this.lastBeatAt = 0;
    this.lastPhaseChangeAt = 0;

    this.beatCallbacks = new Set();
    this.phaseChangeCallbacks = new Set();
    this.anomalyCallbacks = new Set();
    this.eventHandlers = new Map();
  }

  init(config?: Partial<HeartbeatConfig>): void {
    if (this.initialized) return;

    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.anomalyDetector.onAnomaly((alert) => {
      this.handleAnomaly(alert);
    });

    this.initialized = true;
    this.emit("beat", { type: "init", timestamp: new Date().toISOString() });
  }

  shutdown(): void {
    this.stop();
    this.initialized = false;
    this.broadcaster.reset();
    this.history.reset();
    this.anomalyDetector.reset();
    this.beatCallbacks.clear();
    this.phaseChangeCallbacks.clear();
    this.anomalyCallbacks.clear();
    this.eventHandlers.clear();
    this.emit("shutdown", { type: "shutdown", timestamp: new Date().toISOString() });
  }

  start(): void {
    if (!this.initialized) {
      this.init();
    }
    if (this.running) return;

    this.running = true;
    this.startTime = Date.now();
    this.scheduleNextBeat();
  }

  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.loopTimer !== null) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
  }

  private scheduleNextBeat(): void {
    if (!this.running) return;

    const phase = this.currentState?.operationalPhase ?? (HEART_PHASE_IDLE as OperationalPhase);
    const interval = this.config.adaptiveFrequency
      ? this.broadcaster.adaptiveFrequency(phase)
      : this.config.collectIntervalMs;

    this.loopTimer = setInterval(() => {
      this.executeBeat();
    }, interval);
  }

  private rescheduleBeat(): void {
    if (this.loopTimer !== null) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    this.scheduleNextBeat();
  }

  private executeBeat(): void {
    if (!this.running) return;

    try {
      const vitalSigns = this.vitalSignsCollector.collect();
      const state = this.calculator.calculate(vitalSigns);

      const waveform = this.waveformGenerator.generateWaveformForPhase(
        state.operationalPhase,
        state.bpm,
        state.amplitude
      );
      state.waveform = waveform;

      const previousPhase = this.currentState?.operationalPhase;
      this.currentState = state;
      this.beatCount++;
      this.lastBeatAt = Date.now();

      this.broadcaster.broadcast(state);
      this.history.record(state);

      if (this.config.anomalyDetectionEnabled) {
        const anomalies = this.anomalyDetector.detect(state);
        state.anomalies = anomalies;

        const recentHistory = this.history.getRecent(60000);
        const arrhythmia = this.anomalyDetector.detectArrhythmia(recentHistory);
        if (arrhythmia) {
          state.anomalies.push(arrhythmia);
        }
      }

      this.notifyBeatCallbacks(state);

      if (previousPhase !== undefined && previousPhase !== state.operationalPhase) {
        const now = Date.now();
        if (now - this.lastPhaseChangeAt >= PHASE_TRANSITION_COOLDOWN_MS) {
          this.lastPhaseChangeAt = now;
          this.notifyPhaseChangeCallbacks(state);
          this.history.markEvent(
            "phase_change",
            `Phase changed from ${previousPhase} to ${state.operationalPhase}`
          );
          this.emit("phaseChange", {
            type: "phaseChange",
            from: previousPhase,
            to: state.operationalPhase,
            timestamp: new Date().toISOString(),
          });
        }
      }

      if (this.config.adaptiveFrequency) {
        this.rescheduleBeat();
      }
    } catch (error) {
      this.emit("error", {
        type: "error",
        error,
        timestamp: new Date().toISOString(),
      });

      const errorState = this.createErrorState(error);
      this.currentState = errorState;
      this.broadcaster.broadcast(errorState);
      this.history.record(errorState);
    }
  }

  private createErrorState(error: unknown): HeartbeatStateInternal {
    const now = new Date();
    return {
      phase: "rest" as HeartPhase,
      bpm: 0,
      rhythm: RhythmType.Flatline,
      vitalSigns: {
        cpuTemperature: 0,
        memoryPressure: 0,
        diskHealth: 0,
        networkLatency: 0,
        processCount: 0,
        threadCount: 0,
        openFileDescriptors: 0,
        errorRate: 1,
        responseTime: 0,
        throughput: 0,
      },
      systemMetrics: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkInBytes: 0,
        networkOutBytes: 0,
        activeConnections: 0,
        requestRate: 0,
        errorRate: 1,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        uptimeSeconds: 0,
        gcPauseMs: 0,
        eventLoopLagMs: 0,
      },
      lastBeatAt: now.toISOString(),
      nextBeatAt: new Date(now.getTime() + 1000).toISOString(),
      beatCount: this.beatCount,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      operationalPhase: HEART_PHASE_ERROR as OperationalPhase,
      amplitude: 0,
      variability: 0,
      diagnosis: `Heartbeat engine error: ${error instanceof Error ? error.message : String(error)}`,
      waveform: this.waveformGenerator.generateFlatline(),
      anomalies: [],
      previousPhase: this.currentState?.operationalPhase ?? (HEART_PHASE_IDLE as OperationalPhase),
      phaseChangedAt: now.toISOString(),
      bpmTarget: 0,
      bpmCurrent: 0,
    };
  }

  private handleAnomaly(alert: AnomalyAlert): void {
    for (const callback of this.anomalyCallbacks) {
      try {
        callback(alert);
      } catch {
        continue;
      }
    }
    this.emit("anomaly", { type: "anomaly", alert, timestamp: new Date().toISOString() });
  }

  private notifyBeatCallbacks(state: HeartbeatStateInternal): void {
    for (const callback of this.beatCallbacks) {
      try {
        callback(state);
      } catch {
        continue;
      }
    }
  }

  private notifyPhaseChangeCallbacks(state: HeartbeatStateInternal): void {
    for (const callback of this.phaseChangeCallbacks) {
      try {
        callback(state);
      } catch {
        continue;
      }
    }
  }

  getState(): HeartbeatStateInternal {
    if (this.currentState !== null) {
      return this.currentState;
    }

    const now = new Date();
    return {
      phase: "rest" as HeartPhase,
      bpm: 60,
      rhythm: RhythmType.Normal,
      vitalSigns: {
        cpuTemperature: 35,
        memoryPressure: 0,
        diskHealth: 1,
        networkLatency: 0,
        processCount: 0,
        threadCount: 0,
        openFileDescriptors: 0,
        errorRate: 0,
        responseTime: 0,
        throughput: 0,
      },
      systemMetrics: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkInBytes: 0,
        networkOutBytes: 0,
        activeConnections: 0,
        requestRate: 0,
        errorRate: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        uptimeSeconds: 0,
        gcPauseMs: 0,
        eventLoopLagMs: 0,
      },
      lastBeatAt: now.toISOString(),
      nextBeatAt: new Date(now.getTime() + 1000).toISOString(),
      beatCount: 0,
      uptime: 0,
      operationalPhase: HEART_PHASE_IDLE as OperationalPhase,
      amplitude: 0.3,
      variability: 0,
      diagnosis: "Not started",
      waveform: [],
      anomalies: [],
      previousPhase: HEART_PHASE_IDLE as OperationalPhase,
      phaseChangedAt: now.toISOString(),
      bpmTarget: 60,
      bpmCurrent: 60,
    };
  }

  onBeat(callback: HeartbeatCallback): void {
    this.beatCallbacks.add(callback);
  }

  onPhaseChange(callback: HeartbeatCallback): void {
    this.phaseChangeCallbacks.add(callback);
  }

  onAnomaly(callback: (alert: AnomalyAlert) => void): void {
    this.anomalyCallbacks.add(callback);
  }

  on(event: HeartbeatEventName, handler: HeartbeatEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: HeartbeatEventName, handler: HeartbeatEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }

  private emit(event: HeartbeatEventName, data: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch {
          continue;
        }
      }
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getBeatCount(): number {
    return this.beatCount;
  }

  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  getCurrentPhase(): OperationalPhase {
    return this.currentState?.operationalPhase ?? (HEART_PHASE_IDLE as OperationalPhase);
  }

  getCurrentBpm(): number {
    return this.currentState?.bpm ?? 60;
  }

  getVitalSignsCollector(): VitalSignsCollector {
    return this.vitalSignsCollector;
  }

  getCalculator(): HeartbeatCalculator {
    return this.calculator;
  }

  getWaveformGenerator(): WaveformGenerator {
    return this.waveformGenerator;
  }

  getBroadcaster(): HeartbeatBroadcaster {
    return this.broadcaster;
  }

  getHistory(): HeartbeatHistory {
    return this.history;
  }

  getAnomalyDetector(): AnomalyDetector {
    return this.anomalyDetector;
  }

  getConfig(): HeartbeatConfig {
    return { ...this.config };
  }

  getStats(): Record<string, unknown> {
    return {
      running: this.running,
      initialized: this.initialized,
      beatCount: this.beatCount,
      uptime: this.getUptime(),
      currentPhase: this.getCurrentPhase(),
      currentBpm: this.getCurrentBpm(),
      subscriberCount: this.broadcaster.subscriberCount(),
      historySize: this.history.getSize(),
      activeAnomalies: this.anomalyDetector.getActiveAnomalyCount(),
      lastBeatAt: this.lastBeatAt,
    };
  }
}
