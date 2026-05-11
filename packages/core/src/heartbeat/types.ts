import type { VitalSigns, AnomalyAlert } from '@paracosm/shared';

export interface HeartbeatConfig {
  intervalMs: number;
  timeoutMs: number;
  bpm: number;
  historyMaxEntries: number;
  historyRetentionMs: number;
  anomalyThresholds: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    errorRate: number;
    latencyMs: number;
    budgetUsage: number;
    connectionDrop: number;
    stalledCycleMs: number;
  };
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkInBytes: number;
  networkOutBytes: number;
  openFileDescriptors: number;
  uptimeSeconds: number;
  loadAverage: number[];
}

export interface EngineMetrics {
  activePersonas: number;
  activeSimulations: number;
  pendingGoals: number;
  completedGoals: number;
  activeConstraints: number;
  violatedConstraints: number;
  entityCount: number;
  relationCount: number;
  eventCount: number;
}

export interface ConnectionMetrics {
  activeConnections: number;
  totalRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
  requestsPerSecond: number;
  errorRate: number;
}

export interface LLMMetrics {
  totalTokensUsed: number;
  promptTokens: number;
  completionTokens: number;
  averageLatencyMs: number;
  requestsPerMinute: number;
  costEstimate: number;
  budgetRemaining: number;
  budgetUtilization: number;
}

export interface WaveformSample {
  timestamp: number;
  value: number;
}

export const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  intervalMs: 5000,
  timeoutMs: 15000,
  bpm: 72,
  historyMaxEntries: 10000,
  historyRetentionMs: 86400000,
  anomalyThresholds: {
    cpuUsage: 0.9,
    memoryUsage: 0.85,
    diskUsage: 0.95,
    errorRate: 0.1,
    latencyMs: 30000,
    budgetUsage: 0.9,
    connectionDrop: 5,
    stalledCycleMs: 60000,
  },
};
