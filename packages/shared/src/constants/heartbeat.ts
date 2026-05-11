export const HEART_PHASE_IDLE = 'idle' as const;
export const HEART_PHASE_LIGHT_WORK = 'light_work' as const;
export const HEART_PHASE_MEDIUM_WORK = 'medium_work' as const;
export const HEART_PHASE_HEAVY_WORK = 'heavy_work' as const;
export const HEART_PHASE_SIMULATING = 'simulating' as const;
export const HEART_PHASE_DEBATING = 'debating' as const;
export const HEART_PHASE_EVOLVING = 'evolving' as const;
export const HEART_PHASE_WAITING = 'waiting' as const;
export const HEART_PHASE_ERROR = 'error' as const;
export const HEART_PHASE_CRITICAL = 'critical' as const;
export const HEART_PHASE_FLATLINE = 'flatline' as const;
export const HEART_PHASE_RECOVERING = 'recovering' as const;

export type HeartPhase =
  | typeof HEART_PHASE_IDLE
  | typeof HEART_PHASE_LIGHT_WORK
  | typeof HEART_PHASE_MEDIUM_WORK
  | typeof HEART_PHASE_HEAVY_WORK
  | typeof HEART_PHASE_SIMULATING
  | typeof HEART_PHASE_DEBATING
  | typeof HEART_PHASE_EVOLVING
  | typeof HEART_PHASE_WAITING
  | typeof HEART_PHASE_ERROR
  | typeof HEART_PHASE_CRITICAL
  | typeof HEART_PHASE_FLATLINE
  | typeof HEART_PHASE_RECOVERING;

export const DEFAULT_BPM: Record<HeartPhase, number> = {
  [HEART_PHASE_IDLE]: 60,
  [HEART_PHASE_LIGHT_WORK]: 80,
  [HEART_PHASE_MEDIUM_WORK]: 100,
  [HEART_PHASE_HEAVY_WORK]: 120,
  [HEART_PHASE_SIMULATING]: 110,
  [HEART_PHASE_DEBATING]: 130,
  [HEART_PHASE_EVOLVING]: 140,
  [HEART_PHASE_WAITING]: 50,
  [HEART_PHASE_ERROR]: 90,
  [HEART_PHASE_CRITICAL]: 160,
  [HEART_PHASE_FLATLINE]: 0,
  [HEART_PHASE_RECOVERING]: 70,
} as const;

export const WAVEFORM_POINTS = 200 as const;

export const PUSH_INTERVALS: Record<HeartPhase, number> = {
  [HEART_PHASE_IDLE]: 1000,
  [HEART_PHASE_LIGHT_WORK]: 750,
  [HEART_PHASE_MEDIUM_WORK]: 500,
  [HEART_PHASE_HEAVY_WORK]: 500,
  [HEART_PHASE_SIMULATING]: 500,
  [HEART_PHASE_DEBATING]: 500,
  [HEART_PHASE_EVOLVING]: 500,
  [HEART_PHASE_WAITING]: 1000,
  [HEART_PHASE_ERROR]: 200,
  [HEART_PHASE_CRITICAL]: 200,
  [HEART_PHASE_FLATLINE]: 200,
  [HEART_PHASE_RECOVERING]: 500,
} as const;

export const HISTORY_RETENTION = {
  recentMs: 60000,
  hourlyMs: 3600000,
  dailyMs: 86400000,
} as const;

export const ANOMALY_THRESHOLDS = {
  tachycardiaBPM: 140,
  bradycardiaBPM: 40,
  maxVariability: 50,
  flatlineTimeoutMs: 3000,
} as const;

export const PHASE_TRANSITION_COOLDOWN_MS = 2000 as const;
export const BPM_TRANSITION_RATE = 10 as const;
export const MIN_BPM = 0 as const;
export const MAX_BPM = 200 as const;
