export type ErrorCode = 'UNKNOWN' | 'LLM_ERROR' | 'CONFIG_ERROR' | 'TOOL_ERROR' | 'SIMULATION_ERROR' | 'HEARTBEAT_ERROR' | 'MEMORY_ERROR' | 'VALIDATION_ERROR' | 'TIMEOUT' | 'RATE_LIMIT' | 'AUTH_ERROR' | 'NOT_FOUND';
export declare class ParacosmError extends Error {
    readonly code: ErrorCode;
    readonly retryable: boolean;
    readonly details?: Record<string, unknown>;
    constructor(message: string, code?: ErrorCode, retryable?: boolean, details?: Record<string, unknown>);
}
export declare class LLMError extends ParacosmError {
    readonly provider?: string;
    readonly model?: string;
    constructor(message: string, provider?: string, model?: string, retryable?: boolean, details?: Record<string, unknown>);
}
export declare class ConfigError extends ParacosmError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class ToolError extends ParacosmError {
    readonly toolId?: string;
    constructor(message: string, toolId?: string, retryable?: boolean, details?: Record<string, unknown>);
}
export declare class SimulationError extends ParacosmError {
    constructor(message: string, retryable?: boolean, details?: Record<string, unknown>);
}
export declare class HeartbeatError extends ParacosmError {
    constructor(message: string, retryable?: boolean, details?: Record<string, unknown>);
}
export declare class MemoryError extends ParacosmError {
    constructor(message: string, retryable?: boolean, details?: Record<string, unknown>);
}
export declare function errorHandler(error: unknown): ParacosmError;
export declare function isRetryable(error: unknown): boolean;
//# sourceMappingURL=errors.d.ts.map