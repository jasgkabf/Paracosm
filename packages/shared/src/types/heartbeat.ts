import type { Timestamped, Identified } from "./common.js";

export enum HeartPhase {
  Systole = "systole",
  Diastole = "diastole",
  Rest = "rest",
}

export interface HeartbeatState {
  phase: HeartPhase;
  bpm: number;
  rhythm: RhythmType;
  vitalSigns: VitalSigns;
  systemMetrics: SystemMetrics;
  lastBeatAt: string;
  nextBeatAt: string;
  beatCount: number;
  uptime: number;
}

export enum RhythmType {
  Normal = "normal",
  Accelerated = "accelerated",
  Decelerated = "decelerated",
  Irregular = "irregular",
  Flatline = "flatline",
}

export interface BPMRange {
  min: number;
  max: number;
  resting: number;
  stressed: number;
}

export interface VitalSigns {
  cpuTemperature: number;
  memoryPressure: number;
  diskHealth: number;
  networkLatency: number;
  processCount: number;
  threadCount: number;
  openFileDescriptors: number;
  errorRate: number;
  responseTime: number;
  throughput: number;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkInBytes: number;
  networkOutBytes: number;
  activeConnections: number;
  requestRate: number;
  errorRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  uptimeSeconds: number;
  gcPauseMs: number;
  eventLoopLagMs: number;
}

export interface EngineStatus {
  engineId: string;
  name: string;
  status: "running" | "idle" | "error" | "stopped" | "starting";
  lastActivityAt: string;
  tasksCompleted: number;
  tasksPending: number;
  tasksFailed: number;
  averageTaskDurationMs: number;
  healthScore: number;
}

export interface ProviderStatus {
  providerId: string;
  providerName: string;
  available: boolean;
  latencyMs: number;
  errorRate: number;
  quotaRemaining: number;
  quotaLimit: number;
  lastRequestAt: string;
  circuitState: "closed" | "open" | "half_open";
}

export interface ResourceMetrics {
  cpuCores: number;
  cpuUsagePercent: number;
  memoryTotalBytes: number;
  memoryUsedBytes: number;
  memoryAvailableBytes: number;
  diskTotalBytes: number;
  diskUsedBytes: number;
  diskAvailableBytes: number;
  swapTotalBytes: number;
  swapUsedBytes: number;
  loadAverage1m: number;
  loadAverage5m: number;
  loadAverage15m: number;
}

export interface ConnectionMetrics {
  activeConnections: number;
  idleConnections: number;
  maxConnections: number;
  connectionRate: number;
  disconnectionRate: number;
  averageLifetime: number;
  failedHandshakes: number;
  timeoutCount: number;
}

export interface WaveformPoint {
  timestamp: string;
  value: number;
  label: string | null;
}

export interface HeartbeatWaveform {
  points: WaveformPoint[];
  startTime: string;
  endTime: string;
  sampleRate: number;
  amplitude: number;
  baseline: number;
}

export enum HeartbeatEventType {
  Beat = "beat",
  Arrhythmia = "arrhythmia",
  Stress = "stress",
  Recovery = "recovery",
  Alert = "alert",
  Threshold = "threshold",
}

export interface HeartbeatEvent {
  id: string;
  type: HeartbeatEventType;
  timestamp: string;
  description: string;
  severity: "info" | "warning" | "critical";
  metricName: string;
  metricValue: number;
  threshold: number | null;
  action: string | null;
}

export interface HeartbeatHistory {
  events: HeartbeatEvent[];
  waveforms: HeartbeatWaveform[];
  startTime: string;
  endTime: string;
  totalBeats: number;
  averageBpm: number;
  peakBpm: number;
  minBpm: number;
  errorCount: number;
  warningCount: number;
}

export enum AnomalyType {
  Spike = "spike",
  Drop = "drop",
  Trend = "trend",
  Oscillation = "oscillation",
  Stagnation = "stagnation",
  Outlier = "outlier",
}

export interface AnomalyAlert {
  id: string;
  type: AnomalyType;
  metricName: string;
  expectedValue: number;
  actualValue: number;
  deviation: number;
  confidence: number;
  detectedAt: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  resolvedAt: string | null;
  remediation: string | null;
  affectedComponents: string[];
}
