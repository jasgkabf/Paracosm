import type { VitalSigns } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';
import type { SystemMetrics, EngineMetrics, ConnectionMetrics, LLMMetrics, HeartbeatConfig } from './types.js';
import { DEFAULT_HEARTBEAT_CONFIG } from './types.js';

const logger = createLogger('HeartbeatCalculator');

export class HeartbeatCalculator {
  private config: HeartbeatConfig;
  private currentBpm: number;

  constructor(config: Partial<HeartbeatConfig> = {}) {
    this.config = { ...DEFAULT_HEARTBEAT_CONFIG, ...config };
    this.currentBpm = this.config.bpm;
  }

  calculateBpm(system: SystemMetrics, engine: EngineMetrics, connections: ConnectionMetrics, llm: LLMMetrics): number {
    let bpm = this.config.bpm;
    const cpuFactor = system.cpuUsage * 40;
    const memoryFactor = system.memoryUsage * 30;
    const errorFactor = connections.errorRate * 50;
    const budgetFactor = llm.budgetUtilization * 20;
    const loadFactor = (system.loadAverage[0] ?? 0) * 10;
    bpm += cpuFactor + memoryFactor + errorFactor + budgetFactor + loadFactor;
    if (engine.violatedConstraints > 0) bpm += engine.violatedConstraints * 5;
    if (connections.failedRequests > 5) bpm += 10;
    bpm = Math.min(Math.max(bpm, 30), 200);
    this.currentBpm = bpm;
    return bpm;
  }

  calculateRhythm(bpm: number): 'normal' | 'elevated' | 'tachycardic' | 'bradycardic' | 'irregular' {
    if (bpm < 50) return 'bradycardic';
    if (bpm < 80) return 'normal';
    if (bpm < 120) return 'elevated';
    if (bpm < 160) return 'tachycardic';
    return 'irregular';
  }

  calculateVitalSigns(system: SystemMetrics, engine: EngineMetrics, connections: ConnectionMetrics, llm: LLMMetrics): VitalSigns {
    const bpm = this.calculateBpm(system, engine, connections, llm);
    const rhythm = this.calculateRhythm(bpm);
    const systolic = 100 + (system.cpuUsage * 40) + (connections.errorRate * 20);
    const diastolic = 60 + (system.memoryUsage * 20) + (llm.budgetUtilization * 10);
    const oxygenSaturation = Math.max(85, 100 - (system.cpuUsage * 10) - (connections.errorRate * 5));
    const temperature = 36.5 + (system.cpuUsage * 1.5) + (engine.violatedConstraints * 0.2);
    return {
      bpm,
      rhythm,
      bloodPressure: { systolic: Math.round(systolic), diastolic: Math.round(diastolic) },
      oxygenSaturation: Math.round(oxygenSaturation * 10) / 10,
      temperature: Math.round(temperature * 10) / 10,
      timestamp: new Date(),
    };
  }

  getCurrentBpm(): number {
    return this.currentBpm;
  }

  getStatus(): 'healthy' | 'warning' | 'critical' {
    if (this.currentBpm < 50 || this.currentBpm > 160) return 'critical';
    if (this.currentBpm > 120 || this.currentBpm < 60) return 'warning';
    return 'healthy';
  }
}
