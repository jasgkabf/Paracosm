import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('ErrorHandler');

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  requestId?: string;
  details?: unknown;
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const statusCode = error.statusCode ?? 500;
  const requestId = request.id;

  logger.error('Request error', {
    method: request.method,
    url: request.url,
    statusCode,
    error: error.message,
    requestId,
  });

  if (statusCode === 400) {
    const response: ErrorResponse = {
      error: 'Bad Request',
      message: error.message,
      statusCode: 400,
      timestamp: new Date().toISOString(),
      requestId,
    };
    reply.status(400).send(response);
    return;
  }

  if (statusCode === 401) {
    const response: ErrorResponse = {
      error: 'Unauthorized',
      message: 'Authentication required',
      statusCode: 401,
      timestamp: new Date().toISOString(),
      requestId,
    };
    reply.status(401).send(response);
    return;
  }

  if (statusCode === 403) {
    const response: ErrorResponse = {
      error: 'Forbidden',
      message: 'Insufficient permissions',
      statusCode: 403,
      timestamp: new Date().toISOString(),
      requestId,
    };
    reply.status(403).send(response);
    return;
  }

  if (statusCode === 404) {
    const response: ErrorResponse = {
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
      statusCode: 404,
      timestamp: new Date().toISOString(),
      requestId,
    };
    reply.status(404).send(response);
    return;
  }

  if (statusCode === 429) {
    const response: ErrorResponse = {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
      statusCode: 429,
      timestamp: new Date().toISOString(),
      requestId,
    };
    reply.status(429).send(response);
    return;
  }

  if (statusCode >= 500) {
    const response: ErrorResponse = {
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      statusCode: 500,
      timestamp: new Date().toISOString(),
      requestId,
    };
    reply.status(500).send(response);
    return;
  }

  const response: ErrorResponse = {
    error: error.name ?? 'Error',
    message: error.message,
    statusCode,
    timestamp: new Date().toISOString(),
    requestId,
  };
  reply.status(statusCode).send(response);
}
