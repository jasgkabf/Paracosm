"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANOMALY_DETECTION_SENSITIVITY = exports.ANOMALY_COOLDOWN_MS = exports.METRICS_AGGREGATION_WINDOWS = exports.VITAL_SIGNS_DEFAULTS = exports.WAVEFORM_AMPLITUDE_SCALE = exports.WAVEFORM_DURATION_S = exports.WAVEFORM_SAMPLE_RATE = exports.ANOMALY_THRESHOLDS = exports.HEARTBEAT_HISTORY_RETENTION_MS = exports.HEARTBEAT_HISTORY_MAX_ENTRIES = exports.HEARTBEAT_TIMEOUT_MS = exports.HEARTBEAT_INTERVAL_MS = exports.BPM_RANGES = exports.MAX_BPM = exports.MIN_BPM = exports.DEFAULT_BPM = void 0;
exports.DEFAULT_BPM = 72;
exports.MIN_BPM = 30;
exports.MAX_BPM = 200;
exports.BPM_RANGES = {
    resting: { min: 60, max: 80 },
    active: { min: 80, max: 120 },
    stressed: { min: 120, max: 160 },
    critical: { min: 160, max: 200 },
};
exports.HEARTBEAT_INTERVAL_MS = 5000;
exports.HEARTBEAT_TIMEOUT_MS = 15000;
exports.HEARTBEAT_HISTORY_MAX_ENTRIES = 10000;
exports.HEARTBEAT_HISTORY_RETENTION_MS = 86400000;
exports.ANOMALY_THRESHOLDS = {
    cpuUsage: 0.9,
    memoryUsage: 0.85,
    diskUsage: 0.95,
    errorRate: 0.1,
    latencyMs: 30000,
    budgetUsage: 0.9,
    connectionDrop: 5,
    stalledCycleMs: 60000,
};
exports.WAVEFORM_SAMPLE_RATE = 100;
exports.WAVEFORM_DURATION_S = 2;
exports.WAVEFORM_AMPLITUDE_SCALE = 1.0;
exports.VITAL_SIGNS_DEFAULTS = {
    bpm: exports.DEFAULT_BPM,
    rhythm: 'normal',
    bloodPressure: {
        systolic: 120,
        diastolic: 80,
    },
    oxygenSaturation: 98,
    temperature: 37.0,
};
exports.METRICS_AGGREGATION_WINDOWS = {
    short: 60000,
    medium: 300000,
    long: 900000,
};
exports.ANOMALY_COOLDOWN_MS = 30000;
exports.ANOMALY_DETECTION_SENSITIVITY = 0.8;
//# sourceMappingURL=heartbeat.js.map