import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface SimulationBody {
  worldId: string;
  scenario: string;
  parameters?: Record<string, unknown>;
  maxDepth?: number;
  iterations?: number;
}

interface SimulationParams {
  simulationId: string;
}

export function registerSimulationRoutes(fastify: FastifyInstance): void {
  fastify.post('/simulation/run', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as SimulationBody;

    if (!body.worldId || !body.scenario) {
      return reply.status(400).send({ error: 'worldId and scenario are required' });
    }

    return reply.send({
      id: `sim_${Date.now()}`,
      worldId: body.worldId,
      scenario: body.scenario,
      status: 'completed',
      results: {
        paths: [],
        scores: [],
        bestPath: null,
      },
      iterations: body.iterations ?? 100,
      durationMs: 0,
      createdAt: new Date().toISOString(),
    });
  });

  fastify.get('/simulation/:simulationId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as SimulationParams;
    return reply.send({
      id: params.simulationId,
      status: 'completed',
      results: {},
      createdAt: new Date().toISOString(),
    });
  });

  fastify.post('/simulation/:simulationId/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as SimulationParams;
    return reply.send({
      id: params.simulationId,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    });
  });

  fastify.get('/simulation/:simulationId/results', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as SimulationParams;
    return reply.send({
      simulationId: params.simulationId,
      paths: [],
      scores: [],
      bestPath: null,
    });
  });

  fastify.get('/simulation', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      simulations: [],
      total: 0,
    });
  });

  fastify.post('/simulation/mcts', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as SimulationBody;
    return reply.send({
      id: `mcts_${Date.now()}`,
      worldId: body.worldId,
      algorithm: 'mcts',
      status: 'completed',
      treeSize: 0,
      bestPath: null,
      createdAt: new Date().toISOString(),
    });
  });
}
