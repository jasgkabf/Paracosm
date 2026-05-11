export const DEFAULT_BPM = 72;
export const MIN_BPM = 30;
export const MAX_BPM = 200;

export const BPM_RANGES = {
  resting: { min: 60, max: 80 },
  active: { min: 80, max: 120 },
  stressed: { min: 120, max: 160 },
  critical: { min: 160, max: 200 },
} as const;

export const HEARTBEAT_INTERVAL_MS = 5000;
export const HEARTBEAT_TIMEOUT_MS = 15000;
export const HEARTBEAT_HISTORY_MAX_ENTRIES = 10000;
export const HEARTBEAT_HISTORY_RETENTION_MS = 86400000;

export const ANOMALY_THRESHOLDS = {
  cpuUsage: 0.9,
  memoryUsage: 0.85,
  diskUsage: 0.95,
  errorRate: 0.1,
  latencyMs: 30000,
  budgetUsage: 0.9,
  connectionDrop: 5,
  stalledCycleMs: 60000,
} as const;

export const WAVEFORM_SAMPLE_RATE = 100;
export const WAVEFORM_DURATION_S = 2;
export const WAVEFORM_AMPLITUDE_SCALE = 1.0;

export const VITAL_SIGNS_DEFAULTS = {
  bpm: DEFAULT_BPM,
  rhythm: 'normal' as const,
  bloodPressure: {
    systolic: 120,
    diastolic: 80,
  },
  oxygenSaturation: 98,
  temperature: 37.0,
} as const;

export const METRICS_AGGREGATION_WINDOWS = {
  short: 60000,
  medium: 300000,
  long: 900000,
} as const;

export const ANOMALY_COOLDOWN_MS = 30000;
export const ANOMALY_DETECTION_SENSITIVITY = 0.8;
