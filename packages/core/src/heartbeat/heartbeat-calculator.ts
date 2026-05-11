import { RhythmType } from "@paracosm/shared";
import type { HeartPhase } from "@paracosm/shared";
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
  DEFAULT_BPM,
  BPM_TRANSITION_RATE,
  MIN_BPM,
  MAX_BPM,
} from "@paracosm/shared";
import type { OperationalPhase } from "@paracosm/shared";
import type { HeartbeatStateInternal, VitalSignsInternal } from "./types.js";

interface PhaseProfile {
  bpm: number;
  rhythm: RhythmType;
  amplitude: number;
  variability: number;
}

const PHASE_PROFILES: Record<OperationalPhase, PhaseProfile> = {
  [HEART_PHASE_IDLE]: { bpm: 60, rhythm: RhythmType.Normal, amplitude: 0.3, variability: 5 },
  [HEART_PHASE_LIGHT_WORK]: { bpm: 80, rhythm: RhythmType.Normal, amplitude: 0.5, variability: 8 },
  [HEART_PHASE_MEDIUM_WORK]: { bpm: 100, rhythm: RhythmType.Normal, amplitude: 0.7, variability: 10 },
  [HEART_PHASE_HEAVY_WORK]: { bpm: 120, rhythm: RhythmType.Accelerated, amplitude: 0.9, variability: 15 },
  [HEART_PHASE_SIMULATING]: { bpm: 110, rhythm: RhythmType.Normal, amplitude: 0.8, variability: 10 },
  [HEART_PHASE_DEBATING]: { bpm: 130, rhythm: RhythmType.Accelerated, amplitude: 0.7, variability: 20 },
  [HEART_PHASE_EVOLVING]: { bpm: 140, rhythm: RhythmType.Accelerated, amplitude: 0.6, variability: 25 },
  [HEART_PHASE_WAITING]: { bpm: 50, rhythm: RhythmType.Decelerated, amplitude: 0.2, variability: 3 },
  [HEART_PHASE_ERROR]: { bpm: 90, rhythm: RhythmType.Irregular, amplitude: 0.4, variability: 30 },
  [HEART_PHASE_CRITICAL]: { bpm: 160, rhythm: RhythmType.Irregular, amplitude: 0.2, variability: 40 },
  [HEART_PHASE_FLATLINE]: { bpm: 0, rhythm: RhythmType.Flatline, amplitude: 0, variability: 0 },
  [HEART_PHASE_RECOVERING]: { bpm: 70, rhythm: RhythmType.Normal, amplitude: 0.8, variability: 15 },
};

export class HeartbeatCalculator {
  private currentBpm: number;
  private targetBpm: number;
  private currentPhase: OperationalPhase;
  private previousPhase: OperationalPhase;
  private phaseChangedAt: string;
  private beatCount: number;
  private startTime: number;
  private bpmHistory: number[];
  private lastCalculationTime: number;

  constructor() {
    this.currentBpm = 60;
    this.targetBpm = 60;
    this.currentPhase = HEART_PHASE_IDLE as OperationalPhase;
    this.previousPhase = HEART_PHASE_IDLE as OperationalPhase;
    this.phaseChangedAt = new Date().toISOString();
    this.beatCount = 0;
    this.startTime = Date.now();
    this.bpmHistory = [];
    this.lastCalculationTime = Date.now();
  }

  calculate(vitalSigns: VitalSignsInternal): HeartbeatStateInternal {
    const phase = this.determinePhase(vitalSigns);
    const bpm = this.calculateBPM(vitalSigns);
    const rhythm = this.calculateRhythm(vitalSigns);
    const amplitude = this.calculateAmplitude(vitalSigns);
    const variability = this.calculateVariability(vitalSigns);
    const cardiacPhase = this.determineCardiacPhase();
    const diagnosis = this.generateDiagnosis(vitalSigns);

    const now = new Date();
    const intervalMs = bpm > 0 ? 60000 / bpm : 1000;
    const nextBeatAt = new Date(now.getTime() + intervalMs);

    if (phase !== this.currentPhase) {
      this.previousPhase = this.currentPhase;
      this.currentPhase = phase;
      this.phaseChangedAt = now.toISOString();
    }

    this.beatCount++;

    return {
      phase: cardiacPhase,
      bpm: this.currentBpm,
      rhythm,
      vitalSigns: this.extractVitalSigns(vitalSigns),
      systemMetrics: this.extractSystemMetrics(vitalSigns),
      lastBeatAt: now.toISOString(),
      nextBeatAt: nextBeatAt.toISOString(),
      beatCount: this.beatCount,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      operationalPhase: phase,
      amplitude,
      variability,
      diagnosis,
      waveform: [],
      anomalies: [],
      previousPhase: this.previousPhase,
      phaseChangedAt: this.phaseChangedAt,
      bpmTarget: this.targetBpm,
      bpmCurrent: this.currentBpm,
    };
  }

  calculateBPM(vitalSigns: VitalSignsInternal): number {
    const phase = this.determinePhase(vitalSigns);
    const profile = PHASE_PROFILES[phase];
    this.targetBpm = profile.bpm;

    const now = Date.now();
    const elapsed = now - this.lastCalculationTime;
    this.lastCalculationTime = now;

    const maxTransition = (BPM_TRANSITION_RATE * elapsed) / 1000;

    if (phase === HEART_PHASE_FLATLINE as OperationalPhase) {
      this.currentBpm = 0;
      return 0;
    }

    if (phase === HEART_PHASE_ERROR as OperationalPhase) {
      const irregularity = Math.sin(Date.now() / 500) * 20;
      this.currentBpm = Math.max(MIN_BPM, Math.min(MAX_BPM, profile.bpm + irregularity));
      return this.currentBpm;
    }

    if (phase === HEART_PHASE_CRITICAL as OperationalPhase) {
      const slowBeat = 40 + Math.sin(Date.now() / 2000) * 10;
      this.currentBpm = Math.max(MIN_BPM, slowBeat);
      return this.currentBpm;
    }

    if (phase === HEART_PHASE_RECOVERING as OperationalPhase) {
      const timeSincePhaseChange = Date.now() - new Date(this.phaseChangedAt).getTime();
      const recoveryProgress = Math.min(1, timeSincePhaseChange / 10000);
      const spikeBpm = 120;
      const targetBpm = 60;
      const recoveryBpm = spikeBpm - (spikeBpm - targetBpm) * recoveryProgress;
      this.targetBpm = recoveryBpm;
    }

    if (phase === HEART_PHASE_EVOLVING as OperationalPhase) {
      const evolveProgress = Math.sin(Date.now() / 5000) * 0.5 + 0.5;
      this.targetBpm = 70 + (110 - 70) * evolveProgress;
    }

    if (phase === HEART_PHASE_DEBATING as OperationalPhase) {
      const debateVariation = Math.sin(Date.now() / 2000) * 20;
      this.targetBpm = profile.bpm + debateVariation;
    }

    const diff = this.targetBpm - this.currentBpm;
    if (Math.abs(diff) <= maxTransition) {
      this.currentBpm = this.targetBpm;
    } else {
      this.currentBpm += Math.sign(diff) * maxTransition;
    }

    this.currentBpm = Math.max(MIN_BPM, Math.min(MAX_BPM, this.currentBpm));

    const variability = profile.variability;
    const noise = (Math.random() - 0.5) * 2 * variability;
    const finalBpm = Math.max(MIN_BPM, Math.min(MAX_BPM, this.currentBpm + noise));

    this.bpmHistory.push(finalBpm);
    if (this.bpmHistory.length > 100) {
      this.bpmHistory.shift();
    }

    return Math.round(finalBpm);
  }

  calculateRhythm(vitalSigns: VitalSignsInternal): RhythmType {
    const phase = this.determinePhase(vitalSigns);
    const profile = PHASE_PROFILES[phase];
    return profile.rhythm;
  }

  calculateAmplitude(vitalSigns: VitalSignsInternal): number {
    const phase = this.determinePhase(vitalSigns);
    const profile = PHASE_PROFILES[phase];

    let amplitude = profile.amplitude;

    const cpuFactor = vitalSigns.systemCpuUsage * 0.2;
    const memoryFactor = vitalSigns.systemMemoryPercentage * 0.15;
    const errorFactor = vitalSigns.errorRate * -0.3;

    amplitude += cpuFactor + memoryFactor + errorFactor;

    if (phase === HEART_PHASE_FLATLINE as OperationalPhase) {
      amplitude = 0;
    }

    return Math.max(0, Math.min(1, amplitude));
  }

  calculateVariability(vitalSigns: VitalSignsInternal): number {
    if (this.bpmHistory.length < 3) return 0;

    const recent = this.bpmHistory.slice(-20);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const squaredDiffs = recent.map((bpm) => (bpm - avg) ** 2);
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;

    return Math.sqrt(variance);
  }

  determinePhase(vitalSigns: VitalSignsInternal): OperationalPhase {
    if (vitalSigns.errorRate > 0.8) {
      return HEART_PHASE_FLATLINE as OperationalPhase;
    }

    if (vitalSigns.errorRate > 0.5) {
      return HEART_PHASE_CRITICAL as OperationalPhase;
    }

    if (vitalSigns.errorRate > 0.2) {
      return HEART_PHASE_ERROR as OperationalPhase;
    }

    if (vitalSigns.engineErrorCount > 3) {
      return HEART_PHASE_ERROR as OperationalPhase;
    }

    const llmLoad = (vitalSigns.llmActiveRequests + vitalSigns.llmQueueDepth) / 100;
    const engineRunning = vitalSigns.engineRunningCount;
    const cpuLoad = vitalSigns.systemCpuUsage;
    const memLoad = vitalSigns.systemMemoryPercentage;

    if (llmLoad > 0.8 && engineRunning > 0) {
      return HEART_PHASE_HEAVY_WORK as OperationalPhase;
    }

    if (engineRunning > 4) {
      return HEART_PHASE_HEAVY_WORK as OperationalPhase;
    }

    if (cpuLoad > 0.8 || memLoad > 0.85) {
      return HEART_PHASE_HEAVY_WORK as OperationalPhase;
    }

    if (vitalSigns.llmActiveRequests > 5) {
      return HEART_PHASE_DEBATING as OperationalPhase;
    }

    if (engineRunning > 2 && vitalSigns.llmActiveRequests > 0) {
      return HEART_PHASE_SIMULATING as OperationalPhase;
    }

    if (cpuLoad > 0.5 || memLoad > 0.6) {
      return HEART_PHASE_MEDIUM_WORK as OperationalPhase;
    }

    if (vitalSigns.taskActiveCount > 0 || vitalSigns.llmActiveRequests > 0) {
      return HEART_PHASE_LIGHT_WORK as OperationalPhase;
    }

    if (vitalSigns.taskPendingCount > 0 && vitalSigns.taskActiveCount === 0) {
      return HEART_PHASE_WAITING as OperationalPhase;
    }

    if (cpuLoad > 0.1 || memLoad > 0.3) {
      return HEART_PHASE_IDLE as OperationalPhase;
    }

    return HEART_PHASE_IDLE as OperationalPhase;
  }

  private determineCardiacPhase(): HeartPhase {
    const cyclePosition = (Date.now() % 1000) / 1000;
    if (cyclePosition < 0.3) {
      return "systole" as HeartPhase;
    } else if (cyclePosition < 0.7) {
      return "diastole" as HeartPhase;
    } else {
      return "rest" as HeartPhase;
    }
  }

  generateDiagnosis(vitalSigns: VitalSignsInternal): string {
    const phase = this.determinePhase(vitalSigns);
    const bpm = this.currentBpm;
    const cpu = vitalSigns.systemCpuUsage;
    const mem = vitalSigns.systemMemoryPercentage;
    const err = vitalSigns.errorRate;
    const llmErr = vitalSigns.llmErrorRate;
    const latency = vitalSigns.wsPingLatencyMs;

    const parts: string[] = [];

    parts.push(`Phase: ${phase}`);
    parts.push(`BPM: ${bpm}`);

    if (cpu > 0.8) parts.push("CPU critical");
    else if (cpu > 0.6) parts.push("CPU elevated");
    else parts.push("CPU normal");

    if (mem > 0.85) parts.push("Memory critical");
    else if (mem > 0.7) parts.push("Memory elevated");
    else parts.push("Memory normal");

    if (err > 0.2) parts.push(`Error rate elevated: ${(err * 100).toFixed(1)}%`);
    if (llmErr > 0.1) parts.push(`LLM error rate: ${(llmErr * 100).toFixed(1)}%`);
    if (latency > 100) parts.push(`Network latency high: ${latency.toFixed(0)}ms`);

    if (phase === HEART_PHASE_FLATLINE as OperationalPhase) {
      parts.unshift("SYSTEM UNRESPONSIVE");
    } else if (phase === HEART_PHASE_CRITICAL as OperationalPhase) {
      parts.unshift("SYSTEM CRITICAL");
    } else if (phase === HEART_PHASE_ERROR as OperationalPhase) {
      parts.unshift("SYSTEM DEGRADED");
    }

    return parts.join(" | ");
  }

  private extractVitalSigns(vitalSigns: VitalSignsInternal): import("@paracosm/shared").VitalSigns {
    return {
      cpuTemperature: vitalSigns.cpuTemperature,
      memoryPressure: vitalSigns.memoryPressure,
      diskHealth: vitalSigns.diskHealth,
      networkLatency: vitalSigns.networkLatency,
      processCount: vitalSigns.processCount,
      threadCount: vitalSigns.threadCount,
      openFileDescriptors: vitalSigns.openFileDescriptors,
      errorRate: vitalSigns.errorRate,
      responseTime: vitalSigns.responseTime,
      throughput: vitalSigns.throughput,
    };
  }

  private extractSystemMetrics(vitalSigns: VitalSignsInternal): import("@paracosm/shared").SystemMetrics {
    return {
      cpuUsage: vitalSigns.systemCpuUsage,
      memoryUsage: vitalSigns.systemMemoryPercentage,
      diskUsage: vitalSigns.systemDiskPercentage,
      networkInBytes: 0,
      networkOutBytes: 0,
      activeConnections: vitalSigns.activeConnections,
      requestRate: 0,
      errorRate: vitalSigns.errorRate,
      p50LatencyMs: vitalSigns.wsPingLatencyMs,
      p95LatencyMs: vitalSigns.wsPingLatencyMs * 1.5,
      p99LatencyMs: vitalSigns.wsPingLatencyMs * 2,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      gcPauseMs: vitalSigns.gcPauseMs,
      eventLoopLagMs: vitalSigns.eventLoopLagMs,
    };
  }

  getCurrentPhase(): OperationalPhase {
    return this.currentPhase;
  }

  getCurrentBpm(): number {
    return this.currentBpm;
  }

  getTargetBpm(): number {
    return this.targetBpm;
  }

  getBpmHistory(): number[] {
    return [...this.bpmHistory];
  }

  reset(): void {
    this.currentBpm = 60;
    this.targetBpm = 60;
    this.currentPhase = HEART_PHASE_IDLE as OperationalPhase;
    this.previousPhase = HEART_PHASE_IDLE as OperationalPhase;
    this.phaseChangedAt = new Date().toISOString();
    this.beatCount = 0;
    this.startTime = Date.now();
    this.bpmHistory = [];
    this.lastCalculationTime = Date.now();
  }
}
