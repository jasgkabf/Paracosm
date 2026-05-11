export class ParacosmError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly cause?: Error;

  constructor(
    message: string,
    code: string,
    details: Record<string, unknown> = {},
    cause?: Error
  ) {
    super(message);
    this.name = "ParacosmError";
    this.code = code;
    this.details = details;
    this.cause = cause;
    Object.setPrototypeOf(this, ParacosmError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      cause: this.cause?.message ?? null,
    };
  }
}

export class LLMError extends ParacosmError {
  constructor(
    message: string,
    details: Record<string, unknown> = {},
    cause?: Error
  ) {
    super(message, "LLM_ERROR", details, cause);
    this.name = "LLMError";
    Object.setPrototypeOf(this, LLMError.prototype);
  }
}

export class ConfigError extends ParacosmError {
  constructor(
    message: string,
    details: Record<string, unknown> = {},
    cause?: Error
  ) {
    super(message, "CONFIG_ERROR", details, cause);
    this.name = "ConfigError";
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

export class ToolError extends ParacosmError {
  constructor(
    message: string,
    details: Record<string, unknown> = {},
    cause?: Error
  ) {
    super(message, "TOOL_ERROR", details, cause);
    this.name = "ToolError";
    Object.setPrototypeOf(this, ToolError.prototype);
  }
}

export class SimulationError extends ParacosmError {
  constructor(
    message: string,
    details: Record<string, unknown> = {},
    cause?: Error
  ) {
    super(message, "SIMULATION_ERROR", details, cause);
    this.name = "SimulationError";
    Object.setPrototypeOf(this, SimulationError.prototype);
  }
}

export class HeartbeatError extends ParacosmError {
  constructor(
    message: string,
    details: Record<string, unknown> = {},
    cause?: Error
  ) {
    super(message, "HEARTBEAT_ERROR", details, cause);
    this.name = "HeartbeatError";
    Object.setPrototypeOf(this, HeartbeatError.prototype);
  }
}

export class MemoryError extends ParacosmError {
  constructor(
    message: string,
    details: Record<string, unknown> = {},
    cause?: Error
  ) {
    super(message, "MEMORY_ERROR", details, cause);
    this.name = "MemoryError";
    Object.setPrototypeOf(this, MemoryError.prototype);
  }
}

export class ValidationError extends ParacosmError {
  constructor(
    message: string,
    details: Record<string, unknown> = {},
    cause?: Error
  ) {
    super(message, "VALIDATION_ERROR", details, cause);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

const RETRYABLE_CODES = new Set([
  "LLM_ERROR",
  "HEARTBEAT_ERROR",
  "TIMEOUT",
  "RATE_LIMIT",
  "NETWORK_ERROR",
  "SERVICE_UNAVAILABLE",
]);

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export function errorHandler(error: unknown): ParacosmError {
  if (error instanceof ParacosmError) {
    return error;
  }
  if (error instanceof Error) {
    const message = error.message;
    if (message.includes("ECONNREFUSED") || message.includes("ECONNRESET")) {
      return new LLMError(message, { originalError: error.name }, error);
    }
    if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
      return new LLMError(message, { originalError: error.name, retryable: true }, error);
    }
    if (message.includes("rate limit") || message.includes("429")) {
      return new LLMError(message, { originalError: error.name, retryable: true }, error);
    }
    if ("statusCode" in error && typeof (error as any).statusCode === "number") {
      const statusCode = (error as any).statusCode;
      const details: Record<string, unknown> = { statusCode, originalError: error.name };
      if (RETRYABLE_STATUS_CODES.has(statusCode)) {
        details.retryable = true;
      }
      return new LLMError(message, details, error);
    }
    return new ParacosmError(message, "UNKNOWN_ERROR", { originalError: error.name }, error);
  }
  if (typeof error === "string") {
    return new ParacosmError(error, "UNKNOWN_ERROR");
  }
  return new ParacosmError(
    "An unknown error occurred",
    "UNKNOWN_ERROR",
    { originalError: String(error) }
  );
}

export function isRetryable(error: ParacosmError): boolean {
  if (RETRYABLE_CODES.has(error.code)) {
    return true;
  }
  if (error.details.retryable === true) {
    return true;
  }
  if (typeof error.details.statusCode === "number" && RETRYABLE_STATUS_CODES.has(error.details.statusCode as number)) {
    return true;
  }
  const message = error.message.toLowerCase();
  if (message.includes("timeout") || message.includes("rate limit") || message.includes("retry")) {
    return true;
  }
  return false;
}
