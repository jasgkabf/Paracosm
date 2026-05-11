import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface LLMConfigBody {
  provider: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  routing?: string;
  budget?: Record<string, unknown>;
}

export function registerLLMConfigRoutes(fastify: FastifyInstance): void {
  fastify.get('/llm-config', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      defaultProvider: 'openai',
      defaultModel: 'gpt-4o',
      providers: [
        { name: 'openai', models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'], enabled: true },
        { name: 'anthropic', models: ['claude-3-opus-20240229', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'], enabled: true },
        { name: 'google', models: ['gemini-1.5-pro', 'gemini-1.5-flash'], enabled: true },
      ],
      routing: { strategy: 'adaptive' },
      budget: { dailyLimit: 10, monthlyLimit: 100 },
    });
  });

  fastify.put('/llm-config', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as LLMConfigBody;
    return reply.send({
      updated: true,
      provider: body.provider,
      updatedAt: new Date().toISOString(),
    });
  });

  fastify.get('/llm-config/providers', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      providers: [
        { name: 'openai', enabled: true, models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
        { name: 'anthropic', enabled: true, models: ['claude-3-opus-20240229', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'] },
        { name: 'google', enabled: true, models: ['gemini-1.5-pro', 'gemini-1.5-flash'] },
        { name: 'deepseek', enabled: false, models: ['deepseek-chat'] },
        { name: 'ollama', enabled: false, models: [] },
      ],
    });
  });

  fastify.post('/llm-config/providers', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as LLMConfigBody;

    if (!body.provider) {
      return reply.status(400).send({ error: 'Provider name is required' });
    }

    return reply.send({
      id: `provider_${Date.now()}`,
      name: body.provider,
      model: body.model ?? 'default',
      baseUrl: body.baseUrl,
      enabled: true,
      createdAt: new Date().toISOString(),
    });
  });

  fastify.get('/llm-config/routing', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      strategy: 'adaptive',
      rules: [],
      analytics: { totalRequests: 0, averageLatency: 0 },
    });
  });

  fastify.put('/llm-config/routing', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { strategy?: string; rules?: unknown[] };
    return reply.send({
      strategy: body.strategy ?? 'adaptive',
      rules: body.rules ?? [],
      updatedAt: new Date().toISOString(),
    });
  });

  fastify.get('/llm-config/budget', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      dailyLimit: 10,
      monthlyLimit: 100,
      dailySpent: 0,
      monthlySpent: 0,
      currency: 'USD',
    });
  });

  fastify.put('/llm-config/budget', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { dailyLimit?: number; monthlyLimit?: number };
    return reply.send({
      dailyLimit: body.dailyLimit ?? 10,
      monthlyLimit: body.monthlyLimit ?? 100,
      updatedAt: new Date().toISOString(),
    });
  });
}
