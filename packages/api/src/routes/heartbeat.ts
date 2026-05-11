import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface HeartbeatBody {
  worldId?: string;
  metrics?: Record<string, number>;
  interval?: number;
}

interface HeartbeatParams {
  heartbeatId: string;
}

export function registerHeartbeatRoutes(fastify: FastifyInstance): void {
  fastify.post('/heartbeat/start', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as HeartbeatBody;
    return reply.send({
      id: `hb_${Date.now()}`,
      status: 'running',
      worldId: body.worldId ?? 'default',
      interval: body.interval ?? 5000,
      startedAt: new Date().toISOString(),
    });
  });

  fastify.post('/heartbeat/:heartbeatId/stop', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as HeartbeatParams;
    return reply.send({
      id: params.heartbeatId,
      status: 'stopped',
      stoppedAt: new Date().toISOString(),
    });
  });

  fastify.get('/heartbeat/:heartbeatId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as HeartbeatParams;
    return reply.send({
      id: params.heartbeatId,
      status: 'running',
      vitalSigns: {
        cpu: 0,
        memory: 0,
        latency: 0,
        errorRate: 0,
        throughput: 0,
      },
      lastBeat: new Date().toISOString(),
    });
  });

  fastify.get('/heartbeat/:heartbeatId/vitals', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as HeartbeatParams;
    return reply.send({
      heartbeatId: params.heartbeatId,
      vitals: {
        cpu: { value: 0, unit: 'percent', status: 'normal' },
        memory: { value: 0, unit: 'bytes', status: 'normal' },
        latency: { value: 0, unit: 'ms', status: 'normal' },
        errorRate: { value: 0, unit: 'percent', status: 'normal' },
        throughput: { value: 0, unit: 'rps', status: 'normal' },
      },
      timestamp: new Date().toISOString(),
    });
  });

  fastify.get('/heartbeat/:heartbeatId/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as HeartbeatParams;
    return reply.send({
      heartbeatId: params.heartbeatId,
      history: [],
      total: 0,
    });
  });

  fastify.get('/heartbeat', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      heartbeats: [],
      total: 0,
    });
  });
}
