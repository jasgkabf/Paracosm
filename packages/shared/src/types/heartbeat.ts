export type HeartPhase =
  | 'systole'
  | 'diastole'
  | 'contraction'
  | 'relaxation'
  | 'rest';

export interface VitalSigns {
  bpm: number;
  rhythm: RhythmType;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  oxygenSaturation: number;
  temperature: number;
  timestamp: Date;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
  activeConnections: number;
  requestRate: number;
  errorRate: number;
  uptime: number;
  timestamp: Date;
}

export interface EngineStatus {
  phase: HeartPhase;
  iteration: number;
  activePersonas: number;
  activeSimulations: number;
  pendingGoals: number;
  completedGoals: number;
  tokenBudgetRemaining: number;
  lastCycleDuration: number;
  timestamp: Date;
}

export interface ProviderStatus {
  provider: string;
  available: boolean;
  latencyMs: number;
  errorRate: number;
  quotaRemaining: number;
  quotaTotal: number;
  lastRequestAt: Date;
  timestamp: Date;
}

export interface ResourceMetrics {
  totalTokensUsed: number;
  totalCost: number;
  tokensByProvider: Record<string, number>;
  costByProvider: Record<string, number>;
  averageLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  timestamp: Date;
}

export interface ConnectionMetrics {
  activeWebSockets: number;
  totalConnections: number;
  messagesPerSecond: number;
  averageMessageSize: number;
  droppedConnections: number;
  reconnectionRate: number;
  timestamp: Date;
}

export interface HeartbeatState {
  id: string;
  phase: HeartPhase;
  vitalSigns: VitalSigns;
  systemMetrics: SystemMetrics;
  engineStatus: EngineStatus;
  providerStatuses: ProviderStatus[];
  resourceMetrics: ResourceMetrics;
  connectionMetrics: ConnectionMetrics;
  anomalies: AnomalyAlert[];
  timestamp: Date;
}

export interface WaveformPoint {
  time: number;
  amplitude: number;
  phase: HeartPhase;
}

export interface HeartbeatWaveform {
  points: WaveformPoint[];
  sampleRate: number;
  duration: number;
  bpm: number;
  rhythm: RhythmType;
}

export interface HeartbeatHistory {
  entries: HeartbeatState[];
  startTime: Date;
  endTime: Date;
  averageBPM: number;
  peakBPM: number;
  minimumBPM: number;
  anomalyCount: number;
}

export interface HeartbeatEvent {
  id: string;
  type: 'phase_change' | 'anomaly' | 'threshold' | 'recovery';
  description: string;
  severity: 'info' | 'warning' | 'critical';
  data: Record<string, unknown>;
  timestamp: Date;
}

export type AnomalyType =
  | 'high_latency'
  | 'provider_down'
  | 'budget_exceeded'
  | 'memory_pressure'
  | 'cpu_spike'
  | 'error_rate_spike'
  | 'connection_drop'
  | 'stalled_cycle'
  | 'quota_depleted';

export interface AnomalyAlert {
  id: string;
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  provider?: string;
  detectedAt: Date;
  resolvedAt?: Date;
  metadata: Record<string, unknown>;
}

export interface BPMRange {
  min: number;
  max: number;
  resting: number;
  active: number;
  stressed: number;
}

export type RhythmType =
  | 'normal'
  | 'elevated'
  | 'stressed'
  | 'calm'
  | 'irregular'
  | 'recovery'
  | 'tachycardic'
  | 'bradycardic';

export interface HeartbeatMetrics {
  bpm: number;
  rhythm: RhythmType;
  timestamp: Date;
  anomalies: AnomalyAlert[];
  systemMetrics: Record<string, unknown>;
  engineMetrics: Record<string, unknown>;
  connectionMetrics: Record<string, unknown>;
  llmMetrics: Record<string, unknown>;
}
