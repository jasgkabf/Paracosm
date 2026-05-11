export declare const DEFAULT_BPM = 72;
export declare const MIN_BPM = 30;
export declare const MAX_BPM = 200;
export declare const BPM_RANGES: {
    readonly resting: {
        readonly min: 60;
        readonly max: 80;
    };
    readonly active: {
        readonly min: 80;
        readonly max: 120;
    };
    readonly stressed: {
        readonly min: 120;
        readonly max: 160;
    };
    readonly critical: {
        readonly min: 160;
        readonly max: 200;
    };
};
export declare const HEARTBEAT_INTERVAL_MS = 5000;
export declare const HEARTBEAT_TIMEOUT_MS = 15000;
export declare const HEARTBEAT_HISTORY_MAX_ENTRIES = 10000;
export declare const HEARTBEAT_HISTORY_RETENTION_MS = 86400000;
export declare const ANOMALY_THRESHOLDS: {
    readonly cpuUsage: 0.9;
    readonly memoryUsage: 0.85;
    readonly diskUsage: 0.95;
    readonly errorRate: 0.1;
    readonly latencyMs: 30000;
    readonly budgetUsage: 0.9;
    readonly connectionDrop: 5;
    readonly stalledCycleMs: 60000;
};
export declare const WAVEFORM_SAMPLE_RATE = 100;
export declare const WAVEFORM_DURATION_S = 2;
export declare const WAVEFORM_AMPLITUDE_SCALE = 1;
export declare const VITAL_SIGNS_DEFAULTS: {
    readonly bpm: 72;
    readonly rhythm: "normal";
    readonly bloodPressure: {
        readonly systolic: 120;
        readonly diastolic: 80;
    };
    readonly oxygenSaturation: 98;
    readonly temperature: 37;
};
export declare const METRICS_AGGREGATION_WINDOWS: {
    readonly short: 60000;
    readonly medium: 300000;
    readonly long: 900000;
};
export declare const ANOMALY_COOLDOWN_MS = 30000;
export declare const ANOMALY_DETECTION_SENSITIVITY = 0.8;
//# sourceMappingURL=heartbeat.d.ts.map