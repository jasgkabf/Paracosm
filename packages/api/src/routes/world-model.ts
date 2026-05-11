import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface WorldModelBody {
  name: string;
  description?: string;
  entities?: Array<{ id: string; name: string; type: string }>;
  relations?: Array<{ source: string; target: string; type: string }>;
  constraints?: Array<{ id: string; type: string; value: unknown }>;
}

interface WorldModelParams {
  worldId: string;
}

export function registerWorldModelRoutes(fastify: FastifyInstance): void {
  fastify.post('/world-model', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as WorldModelBody;

    if (!body.name) {
      return reply.status(400).send({ error: 'World model name is required' });
    }

    return reply.send({
      id: `world_${Date.now()}`,
      name: body.name,
      description: body.description ?? '',
      entityCount: body.entities?.length ?? 0,
      relationCount: body.relations?.length ?? 0,
      constraintCount: body.constraints?.length ?? 0,
      createdAt: new Date().toISOString(),
    });
  });

  fastify.get('/world-model/:worldId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as WorldModelParams;
    return reply.send({
      id: params.worldId,
      name: 'Sample World',
      entities: [],
      relations: [],
      constraints: [],
      createdAt: new Date().toISOString(),
    });
  });

  fastify.put('/world-model/:worldId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as WorldModelParams;
    const body = request.body as WorldModelBody;
    return reply.send({
      id: params.worldId,
      name: body.name ?? 'Updated World',
      updatedAt: new Date().toISOString(),
    });
  });

  fastify.delete('/world-model/:worldId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as WorldModelParams;
    return reply.send({ deleted: true, worldId: params.worldId });
  });

  fastify.get('/world-model/:worldId/entities', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as WorldModelParams;
    return reply.send({
      worldId: params.worldId,
      entities: [],
      total: 0,
    });
  });

  fastify.post('/world-model/:worldId/entities', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as WorldModelParams;
    const body = request.body as { name: string; type: string };
    return reply.send({
      id: `entity_${Date.now()}`,
      worldId: params.worldId,
      name: body.name,
      type: body.type,
      createdAt: new Date().toISOString(),
    });
  });

  fastify.get('/world-model/:worldId/graph', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as WorldModelParams;
    return reply.send({
      worldId: params.worldId,
      nodes: [],
      edges: [],
    });
  });

  fastify.get('/world-model', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      worlds: [],
      total: 0,
    });
  });
}
