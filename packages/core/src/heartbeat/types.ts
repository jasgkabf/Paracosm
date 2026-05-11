import type {
  HeartbeatState,
  RhythmType,
  VitalSigns,
  SystemMetrics as SharedSystemMetrics,
  EngineStatus,
  ProviderStatus,
  WaveformPoint,
  AnomalyAlert,
  AnomalyType,
  HeartbeatEvent,
  HeartPhase,
} from "@paracosm/shared";
import type {
  OperationalPhase,
} from "@paracosm/shared";

export type {
  HeartbeatState,
  RhythmType,
  VitalSigns,
  SharedSystemMetrics,
  EngineStatus,
  ProviderStatus,
  WaveformPoint,
  AnomalyAlert,
  AnomalyType,
  HeartbeatEvent,
  HeartPhase,
  OperationalPhase,
};

export interface HeartbeatConfig {
  collectIntervalMs: number;
  broadcastIntervalMs: number;
  historyRetentionMs: number;
  anomalyDetectionEnabled: boolean;
  waveformPointsPerBeat: number;
  maxHistorySize: number;
  adaptiveFrequency: boolean;
  compressionThreshold: number;
  phaseTransitionCooldownMs: number;
  bpmTransitionRate: number;
}

export const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  collectIntervalMs: 1000,
  broadcastIntervalMs: 1000,
  historyRetentionMs: 86400000,
  anomalyDetectionEnabled: true,
  waveformPointsPerBeat: 200,
  maxHistorySize: 100000,
  adaptiveFrequency: true,
  compressionThreshold: 0.7,
  phaseTransitionCooldownMs: 2000,
  bpmTransitionRate: 10,
};

export interface HeartbeatStateInternal extends HeartbeatState {
  operationalPhase: OperationalPhase;
  amplitude: number;
  variability: number;
  diagnosis: string;
  waveform: WaveformPoint[];
  anomalies: AnomalyAlert[];
  previousPhase: OperationalPhase;
  phaseChangedAt: string;
  bpmTarget: number;
  bpmCurrent: number;
}

export interface VitalSignsInternal extends VitalSigns {
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
  systemCpuUsage: number;
  systemMemoryPercentage: number;
  systemDiskPercentage: number;
  eventLoopLagMs: number;
  gcPauseMs: number;
  openHandles: number;
  activeConnections: number;
  wsPingLatencyMs: number;
  llmActiveRequests: number;
  llmQueueDepth: number;
  llmAvgResponseTimeMs: number;
  llmErrorRate: number;
  llmTokenThroughput: number;
  engineErrorCount: number;
  engineIdleCount: number;
  engineRunningCount: number;
  taskPendingCount: number;
  taskActiveCount: number;
  taskFailedCount: number;
}

export interface WaveformConfig {
  sampleRate: number;
  amplitude: number;
  baseline: number;
  pWaveDuration: number;
  pWaveAmplitude: number;
  qWaveDuration: number;
  qWaveAmplitude: number;
  rWaveDuration: number;
  rWaveAmplitude: number;
  sWaveDuration: number;
  sWaveAmplitude: number;
  tWaveDuration: number;
  tWaveAmplitude: number;
  uWaveDuration: number;
  uWaveAmplitude: number;
  prSegmentDuration: number;
  stSegmentDuration: number;
}

export const DEFAULT_WAVEFORM_CONFIG: WaveformConfig = {
  sampleRate: 200,
  amplitude: 1.0,
  baseline: 0.0,
  pWaveDuration: 0.08,
  pWaveAmplitude: 0.15,
  qWaveDuration: 0.02,
  qWaveAmplitude: -0.1,
  rWaveDuration: 0.03,
  rWaveAmplitude: 1.0,
  sWaveDuration: 0.02,
  sWaveAmplitude: -0.2,
  tWaveDuration: 0.12,
  tWaveAmplitude: 0.25,
  uWaveDuration: 0.03,
  uWaveAmplitude: 0.05,
  prSegmentDuration: 0.06,
  stSegmentDuration: 0.08,
};

export interface AnomalyState {
  activeAnomalies: Map<string, AnomalyAlert>;
  lastCheckAt: string;
  checkCount: number;
  anomalyHistory: AnomalyAlert[];
  suppressedUntil: Map<string, number>;
  suppressionDurationMs: number;
}

export interface HistoryBucket {
  timestamp: string;
  bpm: number;
  phase: OperationalPhase;
  rhythm: RhythmType;
  amplitude: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  events: HeartbeatEvent[];
}

export type HeartbeatCallback = (state: HeartbeatStateInternal) => void;

export interface EngineMetricsSnapshot {
  worldModel: EngineStatus;
  personaMesh: EngineStatus;
  simulation: EngineStatus;
  strategy: EngineStatus;
  memory: EngineStatus;
  tools: EngineStatus;
  orchestrator: EngineStatus;
}

export interface ProviderMetricsSnapshot {
  providerId: string;
  providerName: string;
  available: boolean;
  latencyMs: number;
  errorRate: number;
  quotaRemaining: number;
  quotaLimit: number;
  circuitState: "closed" | "open" | "half_open";
  activeRequests: number;
  totalRequests: number;
  totalErrors: number;
  lastRequestAt: string;
}

export interface CompressedHeartbeat {
  ts: number;
  ph: OperationalPhase;
  bpm: number;
  rh: RhythmType;
  amp: number;
  wf: number[];
  err: number;
  cpu: number;
  mem: number;
  conn: number;
}

export interface AggregatedHeartbeat {
  startTime: string;
  endTime: string;
  avgBpm: number;
  minBpm: number;
  maxBpm: number;
  dominantPhase: OperationalPhase;
  dominantRhythm: RhythmType;
  avgAmplitude: number;
  avgErrorRate: number;
  avgCpuUsage: number;
  avgMemoryUsage: number;
  errorCount: number;
  beatCount: number;
}

export interface TaskMetrics {
  pendingCount: number;
  activeCount: number;
  completedCount: number;
  failedCount: number;
  averageDurationMs: number;
  maxDurationMs: number;
  throughputPerMinute: number;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsLastMinute: number;
  errorsLast5Minutes: number;
  errorsLast15Minutes: number;
  errorRate: number;
  topErrorTypes: Array<{ type: string; count: number; lastOccurrence: string }>;
  lastErrorAt: string | null;
}

export interface ProcessMetrics {
  pid: number;
  uptimeSeconds: number;
  memoryHeapUsed: number;
  memoryHeapTotal: number;
  memoryRss: number;
  memoryExternal: number;
  cpuUserTime: number;
  cpuSystemTime: number;
  openHandles: number;
  eventLoopLagMs: number;
  gcPauseMs: number;
}

export type HeartbeatEventName =
  | "beat"
  | "phaseChange"
  | "anomaly"
  | "error"
  | "recovery"
  | "flatline"
  | "shutdown";

export type HeartbeatEventHandler = (data: unknown) => void;

export interface ConnectionEvent {
  type: "connect" | "disconnect" | "error" | "ping" | "message" | "reconnect";
  clientId?: string;
  bytesIn?: number;
  bytesOut?: number;
  latencyMs?: number;
  timestamp: string;
}

export interface LLMRequestEvent {
  type: "request_start" | "request_end" | "request_error" | "queue_add" | "queue_remove";
  providerId: string;
  requestId: string;
  tokensIn?: number;
  tokensOut?: number;
  durationMs?: number;
  cost?: number;
  error?: string;
  timestamp: string;
}
