import type { VitalSigns, HeartbeatMetrics, AnomalyAlert } from '@paracosm/shared';
import { ok, err, type Result, createLogger } from '@paracosm/shared';
import { VitalSignsCollector } from './vital-signs-collector.js';
import { HeartbeatCalculator } from './heartbeat-calculator.js';
import { WaveformGenerator } from './waveform-generator.js';
import { HeartbeatBroadcaster } from './heartbeat-broadcaster.js';
import { HeartbeatHistory } from './heartbeat-history.js';
import { AnomalyDetector } from './anomaly-detector.js';
import type { HeartbeatConfig, SystemMetrics, EngineMetrics, ConnectionMetrics, LLMMetrics } from './types.js';
import { DEFAULT_HEARTBEAT_CONFIG } from './types.js';

const logger = createLogger('HeartbeatEngine');

export class HeartbeatEngine {
  private config: HeartbeatConfig;
  private collector: VitalSignsCollector;
  private calculator: HeartbeatCalculator;
  private waveformGenerator: WaveformGenerator;
  private broadcaster: HeartbeatBroadcaster;
  private history: HeartbeatHistory;
  private anomalyDetector: AnomalyDetector;
  private running: boolean = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastHeartbeat: HeartbeatMetrics | null = null;
  private listeners: Map<string, Array<(data: unknown) => void>> = new Map();

  constructor(config: Partial<HeartbeatConfig> = {}) {
    this.config = { ...DEFAULT_HEARTBEAT_CONFIG, ...config };
    this.collector = new VitalSignsCollector();
    this.calculator = new HeartbeatCalculator(this.config);
    this.waveformGenerator = new WaveformGenerator();
    this.broadcaster = new HeartbeatBroadcaster();
    this.history = new HeartbeatHistory(this.config.historyMaxEntries, this.config.historyRetentionMs);
    this.anomalyDetector = new AnomalyDetector(this.config);
  }

  on(event: string, listener: (data: unknown) => void): () => void {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
    return () => {
      const list = this.listeners.get(event);
      if (list) {
        const idx = list.indexOf(listener);
        if (idx !== -1) list.splice(idx, 1);
      }
    };
  }

  private emitEvent(event: string, data: unknown): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) { try { listener(data); } catch (error) { logger.error(`Event listener error: ${error}`); } }
    }
  }

  start(): Result<boolean> {
    if (this.running) return ok(true);
    this.running = true;
    this.intervalId = setInterval(() => this.beat(), this.config.intervalMs);
    logger.info(`Heartbeat engine started at ${this.config.bpm} BPM`);
    this.emitEvent('heartbeat:started', null);
    return ok(true);
  }

  stop(): Result<boolean> {
    if (!this.running) return ok(true);
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('Heartbeat engine stopped');
    this.emitEvent('heartbeat:stopped', null);
    return ok(true);
  }

  beat(): HeartbeatMetrics {
    const systemMetrics = this.collector.collectSystemMetrics();
    const engineMetrics = this.collector.collectEngineMetrics();
    const connectionMetrics = this.collector.collectConnectionMetrics();
    const llmMetrics = this.collector.collectLLMMetrics();
    const vitalSigns = this.calculator.calculateVitalSigns(systemMetrics, engineMetrics, connectionMetrics, llmMetrics);
    const anomalies = this.anomalyDetector.detect({
      bpm: vitalSigns.bpm,
      rhythm: vitalSigns.rhythm,
      timestamp: new Date(),
      anomalies: [],
      systemMetrics: systemMetrics as unknown as Record<string, unknown>,
      engineMetrics: engineMetrics as unknown as Record<string, unknown>,
      connectionMetrics: connectionMetrics as unknown as Record<string, unknown>,
      llmMetrics: llmMetrics as unknown as Record<string, unknown>,
    } as HeartbeatMetrics);
    const metrics: HeartbeatMetrics = {
      bpm: vitalSigns.bpm,
      rhythm: vitalSigns.rhythm,
      timestamp: new Date(),
      anomalies,
      systemMetrics: systemMetrics as unknown as Record<string, unknown>,
      engineMetrics: engineMetrics as unknown as Record<string, unknown>,
      connectionMetrics: connectionMetrics as unknown as Record<string, unknown>,
      llmMetrics: llmMetrics as unknown as Record<string, unknown>,
    };
    this.lastHeartbeat = metrics;
    this.history.add(metrics);
    this.broadcaster.broadcast(metrics);
    this.emitEvent('heartbeat:beat', metrics);
    return metrics;
  }

  getVitalSigns(): VitalSigns {
    if (!this.lastHeartbeat) {
      return this.calculator.calculateVitalSigns(
        this.collector.collectSystemMetrics(),
        this.collector.collectEngineMetrics(),
        this.collector.collectConnectionMetrics(),
        this.collector.collectLLMMetrics(),
      );
    }
    return {
      bpm: this.lastHeartbeat.bpm,
      rhythm: this.lastHeartbeat.rhythm,
      bloodPressure: { systolic: 120, diastolic: 80 },
      oxygenSaturation: 98,
      temperature: 37.0,
      timestamp: new Date(),
    };
  }

  getBpm(): number {
    return this.calculator.getCurrentBpm();
  }

  getStatus(): 'healthy' | 'warning' | 'critical' {
    return this.calculator.getStatus();
  }

  getWaveform(): Array<{ timestamp: number; value: number }> {
    const vitalSigns = this.getVitalSigns();
    return this.waveformGenerator.generate(vitalSigns.bpm, vitalSigns.rhythm);
  }

  getLastHeartbeat(): HeartbeatMetrics | null {
    return this.lastHeartbeat;
  }

  getHistory(count?: number): HeartbeatMetrics[] {
    return this.history.getRecent(count);
  }

  getAnomalies(durationMs?: number): AnomalyAlert[] {
    return this.history.getAnomalies(durationMs);
  }

  subscribe(listener: (metrics: HeartbeatMetrics) => void): () => void {
    return this.broadcaster.subscribe(listener);
  }

  updateEngineMetrics(updates: Partial<EngineMetrics>): void {
    this.collector.updateEngineMetrics(updates);
  }

  updateLLMMetrics(updates: Partial<LLMMetrics>): void {
    this.collector.updateLLMMetrics(updates);
  }

  isRunning(): boolean {
    return this.running;
  }

  getConfig(): HeartbeatConfig {
    return { ...this.config };
  }

  clear(): void {
    this.stop();
    this.history.clear();
    this.anomalyDetector.clear();
    this.broadcaster.clear();
    this.lastHeartbeat = null;
    this.emitEvent('heartbeat:cleared', null);
  }
}
