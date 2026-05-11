import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from "fastify";
import { createLogger, ParacosmError } from "@paracosm/shared";

const logger = createLogger("api:middleware:error-handler");

export enum ErrorCode {
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  BAD_REQUEST = "BAD_REQUEST",
  CONFLICT = "CONFLICT",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  TIMEOUT = "TIMEOUT",
  LLM_ERROR = "LLM_ERROR",
  SIMULATION_ERROR = "SIMULATION_ERROR",
  TOOL_ERROR = "TOOL_ERROR",
  CONFIG_ERROR = "CONFIG_ERROR",
  HEARTBEAT_ERROR = "HEARTBEAT_ERROR",
  MEMORY_ERROR = "MEMORY_ERROR",
}

const ERROR_STATUS_MAP: Record<string, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.AUTHENTICATION_ERROR]: 401,
  [ErrorCode.AUTHORIZATION_ERROR]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.TIMEOUT]: 504,
  [ErrorCode.LLM_ERROR]: 502,
  [ErrorCode.SIMULATION_ERROR]: 500,
  [ErrorCode.TOOL_ERROR]: 500,
  [ErrorCode.CONFIG_ERROR]: 500,
  [ErrorCode.HEARTBEAT_ERROR]: 500,
  [ErrorCode.MEMORY_ERROR]: 500,
  [ErrorCode.UNKNOWN_ERROR]: 500,
};

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
    stack: string | null;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

function formatError(error: Error | FastifyError | ParacosmError, requestId: string): ErrorResponse {
  const timestamp = new Date().toISOString();

  if (error instanceof ParacosmError) {
    const statusCode = ERROR_STATUS_MAP[error.code] ?? 500;
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        stack: statusCode >= 500 ? (error.stack ?? null) : null,
      },
      meta: { requestId, timestamp },
    };
  }

  if ("statusCode" in error && typeof (error as FastifyError).statusCode === "number") {
    const fastifyError = error as FastifyError;
    const statusCode = fastifyError.statusCode ?? 500;
    const code = mapStatusCodeToErrorCode(statusCode);
    return {
      success: false,
      error: {
        code,
        message: fastifyError.message || "Request processing error",
        details: fastifyError.validation
          ? { validation: fastifyError.validation }
          : {},
        stack: statusCode >= 500 ? (fastifyError.stack ?? null) : null,
      },
      meta: { requestId, timestamp },
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error.message || "An internal error occurred",
        details: {},
        stack: error.stack ?? null,
      },
      meta: { requestId, timestamp },
    };
  }

  return {
    success: false,
    error: {
      code: ErrorCode.UNKNOWN_ERROR,
      message: "An unknown error occurred",
      details: {},
      stack: null,
    },
    meta: { requestId, timestamp },
  };
}

function mapStatusCodeToErrorCode(statusCode: number): ErrorCode {
  switch (statusCode) {
    case 400: return ErrorCode.BAD_REQUEST;
    case 401: return ErrorCode.AUTHENTICATION_ERROR;
    case 403: return ErrorCode.AUTHORIZATION_ERROR;
    case 404: return ErrorCode.NOT_FOUND;
    case 409: return ErrorCode.CONFLICT;
    case 429: return ErrorCode.RATE_LIMIT_EXCEEDED;
    case 500: return ErrorCode.INTERNAL_ERROR;
    case 502: return ErrorCode.LLM_ERROR;
    case 503: return ErrorCode.SERVICE_UNAVAILABLE;
    case 504: return ErrorCode.TIMEOUT;
    default: return ErrorCode.UNKNOWN_ERROR;
  }
}

function getStatusCode(error: Error | FastifyError | ParacosmError): number {
  if (error instanceof ParacosmError) {
    return ERROR_STATUS_MAP[error.code] ?? 500;
  }

  if ("statusCode" in error && typeof (error as FastifyError).statusCode === "number") {
    return (error as FastifyError).statusCode ?? 500;
  }

  return 500;
}

export async function errorHandler(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = getStatusCode(error);
    const errorResponse = formatError(error, request.id);

    if (statusCode >= 500) {
      logger.error("Internal server error", error, {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode,
      });
    } else if (statusCode >= 400) {
      logger.warn("Client error", {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode,
        errorCode: errorResponse.error.code,
      });
    }

    reply.status(statusCode).send(errorResponse);
  });
}

export { formatError, getStatusCode, ERROR_STATUS_MAP };
export type { ErrorResponse };
