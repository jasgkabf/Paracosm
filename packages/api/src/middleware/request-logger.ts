import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('RequestLoggerMiddleware');

export function requestLogger(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  const startTime = Date.now();
  const requestId = request.id;

  request.logRequest = () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      requestId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: duration,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  };

  reply.raw.on('finish', () => {
    request.logRequest?.();
  });

  done();
}

declare module 'fastify' {
  interface FastifyRequest {
    logRequest?: () => void;
  }
}
