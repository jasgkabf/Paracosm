import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('AuthMiddleware');

interface AuthConfig {
  requireAuth: boolean;
  apiKeyHeader: string;
  bearerPrefix: string;
  publicPaths: string[];
}

const config: AuthConfig = {
  requireAuth: false,
  apiKeyHeader: 'x-api-key',
  bearerPrefix: 'bearer ',
  publicPaths: ['/health', '/ready', '/live', '/'],
};

export function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  if (!config.requireAuth) {
    done();
    return;
  }

  if (config.publicPaths.includes(request.url) || request.url.startsWith('/ws')) {
    done();
    return;
  }

  const authHeader = request.headers.authorization;
  const apiKey = request.headers[config.apiKeyHeader] as string | undefined;

  if (authHeader) {
    const token = authHeader.toLowerCase().startsWith(config.bearerPrefix)
      ? authHeader.substring(config.bearerPrefix.length)
      : authHeader;

    if (token && token.length > 0) {
      request.user = { id: 'authenticated', scopes: ['*'] };
      done();
      return;
    }
  }

  if (apiKey && apiKey.length > 0) {
    request.user = { id: 'api_key_user', scopes: ['*'] };
    done();
    return;
  }

  logger.warn('Authentication failed', {
    url: request.url,
    method: request.method,
    ip: request.ip,
  });

  reply.status(401).send({
    error: 'Unauthorized',
    message: 'Authentication required. Provide a valid Authorization header or API key.',
  });
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; scopes: string[] };
  }
}
