import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface UserBody {
  username: string;
  email?: string;
  preferences?: Record<string, unknown>;
}

interface UserParams {
  userId: string;
}

export function registerUserRoutes(fastify: FastifyInstance): void {
  fastify.post('/user', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as UserBody;

    if (!body.username) {
      return reply.status(400).send({ error: 'Username is required' });
    }

    return reply.send({
      id: `user_${Date.now()}`,
      username: body.username,
      email: body.email ?? '',
      preferences: body.preferences ?? {},
      createdAt: new Date().toISOString(),
    });
  });

  fastify.get('/user/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as UserParams;
    return reply.send({
      id: params.userId,
      username: 'user',
      email: '',
      preferences: {},
      createdAt: new Date().toISOString(),
    });
  });

  fastify.put('/user/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as UserParams;
    const body = request.body as UserBody;
    return reply.send({
      id: params.userId,
      username: body.username ?? 'user',
      email: body.email ?? '',
      preferences: body.preferences ?? {},
      updatedAt: new Date().toISOString(),
    });
  });

  fastify.delete('/user/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as UserParams;
    return reply.send({ deleted: true, userId: params.userId });
  });

  fastify.get('/user/:userId/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as UserParams;
    return reply.send({
      userId: params.userId,
      preferences: {
        defaultModel: 'gpt-4o',
        defaultProvider: 'openai',
        theme: 'dark',
        language: 'en',
      },
    });
  });

  fastify.put('/user/:userId/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as UserParams;
    const body = request.body as Record<string, unknown>;
    return reply.send({
      userId: params.userId,
      preferences: body,
      updatedAt: new Date().toISOString(),
    });
  });

  fastify.get('/user/:userId/sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as UserParams;
    return reply.send({
      userId: params.userId,
      sessions: [],
      total: 0,
    });
  });
}
