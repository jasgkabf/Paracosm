export type ErrorCode =
  | 'UNKNOWN'
  | 'LLM_ERROR'
  | 'CONFIG_ERROR'
  | 'TOOL_ERROR'
  | 'SIMULATION_ERROR'
  | 'HEARTBEAT_ERROR'
  | 'MEMORY_ERROR'
  | 'VALIDATION_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'AUTH_ERROR'
  | 'NOT_FOUND';

export class ParacosmError extends Error {
  public readonly code: ErrorCode;
  public readonly retryable: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode = 'UNKNOWN',
    retryable: boolean = false,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ParacosmError';
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

export class LLMError extends ParacosmError {
  public readonly provider?: string;
  public readonly model?: string;

  constructor(
    message: string,
    provider?: string,
    model?: string,
    retryable: boolean = false,
    details?: Record<string, unknown>,
  ) {
    super(message, 'LLM_ERROR', retryable, details);
    this.name = 'LLMError';
    this.provider = provider;
    this.model = model;
  }
}

export class ConfigError extends ParacosmError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message, 'CONFIG_ERROR', false, details);
    this.name = 'ConfigError';
  }
}

export class ToolError extends ParacosmError {
  public readonly toolId?: string;

  constructor(
    message: string,
    toolId?: string,
    retryable: boolean = false,
    details?: Record<string, unknown>,
  ) {
    super(message, 'TOOL_ERROR', retryable, details);
    this.name = 'ToolError';
    this.toolId = toolId;
  }
}

export class SimulationError extends ParacosmError {
  constructor(
    message: string,
    retryable: boolean = false,
    details?: Record<string, unknown>,
  ) {
    super(message, 'SIMULATION_ERROR', retryable, details);
    this.name = 'SimulationError';
  }
}

export class HeartbeatError extends ParacosmError {
  constructor(
    message: string,
    retryable: boolean = false,
    details?: Record<string, unknown>,
  ) {
    super(message, 'HEARTBEAT_ERROR', retryable, details);
    this.name = 'HeartbeatError';
  }
}

export class MemoryError extends ParacosmError {
  constructor(
    message: string,
    retryable: boolean = false,
    details?: Record<string, unknown>,
  ) {
    super(message, 'MEMORY_ERROR', retryable, details);
    this.name = 'MemoryError';
  }
}

const RETRYABLE_CODES: ErrorCode[] = [
  'TIMEOUT',
  'RATE_LIMIT',
  'LLM_ERROR',
  'HEARTBEAT_ERROR',
];

export function errorHandler(error: unknown): ParacosmError {
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

export function isRetryable(error: unknown): boolean {
  if (error instanceof ParacosmError) {
    return error.retryable || RETRYABLE_CODES.includes(error.code);
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('503') ||
      message.includes('502') ||
      message.includes('econnreset') ||
      message.includes('econnrefused')
    );
  }
  return false;
}
