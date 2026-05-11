import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface StrategyBody {
  name: string;
  type: string;
  parameters?: Record<string, unknown>;
  fitnessCriteria?: Array<{ metric: string; weight: number; direction: 'maximize' | 'minimize' }>;
}

interface StrategyParams {
  strategyId: string;
}

export function registerStrategyRoutes(fastify: FastifyInstance): void {
  fastify.post('/strategy', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as StrategyBody;

    if (!body.name || !body.type) {
      return reply.status(400).send({ error: 'name and type are required' });
    }

    return reply.send({
      id: `strat_${Date.now()}`,
      name: body.name,
      type: body.type,
      parameters: body.parameters ?? {},
      fitnessCriteria: body.fitnessCriteria ?? [],
      createdAt: new Date().toISOString(),
    });
  });

  fastify.get('/strategy/:strategyId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as StrategyParams;
    return reply.send({
      id: params.strategyId,
      name: 'Sample Strategy',
      type: 'evolutionary',
      fitness: 0,
      generation: 0,
    });
  });

  fastify.put('/strategy/:strategyId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as StrategyParams;
    const body = request.body as StrategyBody;
    return reply.send({
      id: params.strategyId,
      name: body.name ?? 'Updated Strategy',
      updatedAt: new Date().toISOString(),
    });
  });

  fastify.delete('/strategy/:strategyId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as StrategyParams;
    return reply.send({ deleted: true, strategyId: params.strategyId });
  });

  fastify.post('/strategy/:strategyId/evolve', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as StrategyParams;
    const body = request.body as { generations?: number; populationSize?: number };
    return reply.send({
      id: params.strategyId,
      generation: body.generations ?? 1,
      bestFitness: 0,
      populationSize: body.populationSize ?? 50,
      completedAt: new Date().toISOString(),
    });
  });

  fastify.get('/strategy/:strategyId/fitness', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as StrategyParams;
    return reply.send({
      strategyId: params.strategyId,
      fitness: 0,
      history: [],
    });
  });

  fastify.get('/strategy', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      strategies: [],
      total: 0,
    });
  });
}
