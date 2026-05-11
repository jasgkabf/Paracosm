"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryError = exports.HeartbeatError = exports.SimulationError = exports.ToolError = exports.ConfigError = exports.LLMError = exports.ParacosmError = void 0;
exports.errorHandler = errorHandler;
exports.isRetryable = isRetryable;
class ParacosmError extends Error {
    code;
    retryable;
    details;
    constructor(message, code = 'UNKNOWN', retryable = false, details) {
        super(message);
        this.name = 'ParacosmError';
        this.code = code;
        this.retryable = retryable;
        this.details = details;
    }
}
exports.ParacosmError = ParacosmError;
class LLMError extends ParacosmError {
    provider;
    model;
    constructor(message, provider, model, retryable = false, details) {
        super(message, 'LLM_ERROR', retryable, details);
        this.name = 'LLMError';
        this.provider = provider;
        this.model = model;
    }
}
exports.LLMError = LLMError;
class ConfigError extends ParacosmError {
    constructor(message, details) {
        super(message, 'CONFIG_ERROR', false, details);
        this.name = 'ConfigError';
    }
}
exports.ConfigError = ConfigError;
class ToolError extends ParacosmError {
    toolId;
    constructor(message, toolId, retryable = false, details) {
        super(message, 'TOOL_ERROR', retryable, details);
        this.name = 'ToolError';
        this.toolId = toolId;
    }
}
exports.ToolError = ToolError;
class SimulationError extends ParacosmError {
    constructor(message, retryable = false, details) {
        super(message, 'SIMULATION_ERROR', retryable, details);
        this.name = 'SimulationError';
    }
}
exports.SimulationError = SimulationError;
class HeartbeatError extends ParacosmError {
    constructor(message, retryable = false, details) {
        super(message, 'HEARTBEAT_ERROR', retryable, details);
        this.name = 'HeartbeatError';
    }
}
exports.HeartbeatError = HeartbeatError;
class MemoryError extends ParacosmError {
    constructor(message, retryable = false, details) {
        super(message, 'MEMORY_ERROR', retryable, details);
        this.name = 'MemoryError';
    }
}
exports.MemoryError = MemoryError;
const RETRYABLE_CODES = [
    'TIMEOUT',
    'RATE_LIMIT',
    'LLM_ERROR',
    'HEARTBEAT_ERROR',
];
function errorHandler(error) {
    if (error instanceof ParacosmError) {
        return error;
    }
    if (error instanceof Error) {
        return new ParacosmError(error.message, 'UNKNOWN', false, {
            originalName: error.name,
            stack: error.stack,
        });
    }
    return new ParacosmError(String(error), 'UNKNOWN');
}
function isRetryable(error) {
    if (error instanceof ParacosmError) {
        return error.retryable || RETRYABLE_CODES.includes(error.code);
    }
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return (message.includes('timeout') ||
            message.includes('rate limit') ||
            message.includes('429') ||
            message.includes('503') ||
            message.includes('502') ||
            message.includes('econnreset') ||
            message.includes('econnrefused'));
    }
    return false;
}
//# sourceMappingURL=errors.js.map