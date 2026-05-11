import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';

export function responseFormatter(
  request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
  done: (err?: Error | null, value?: unknown) => void,
): void {
  const statusCode = reply.statusCode;

  if (statusCode >= 400) {
    done(null, payload);
    return;
  }

  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      done(null, JSON.stringify(formatSuccess(parsed, statusCode)));
      return;
    } catch {
      done(null, payload);
      return;
    }
  }

  if (typeof payload === 'object' && payload !== null) {
    done(null, JSON.stringify(formatSuccess(payload, statusCode)));
    return;
  }

  done(null, payload);
}

function formatSuccess(data: unknown, statusCode: number): unknown {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if ('error' in obj || 'statusCode' in obj) {
      return data;
    }
  }

  return data;
}
