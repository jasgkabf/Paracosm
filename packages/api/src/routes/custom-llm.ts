import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface CustomLLMBody {
  name: string;
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  requestMapping?: Record<string, unknown>;
  responseMapping?: Record<string, unknown>;
  supportedModels?: string[];
  template?: string;
}

interface CustomLLMParams {
  providerId: string;
}

export function registerCustomLLMRoutes(fastify: FastifyInstance): void {
  fastify.post('/custom-llm', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CustomLLMBody;

    if (!body.name || !body.baseUrl) {
      return reply.status(400).send({ error: 'name and baseUrl are required' });
    }

    return reply.send({
      id: `custom_${Date.now()}`,
      name: body.name,
      baseUrl: body.baseUrl,
      headers: body.headers ?? {},
      requestMapping: body.requestMapping ?? {},
      responseMapping: body.responseMapping ?? {},
      supportedModels: body.supportedModels ?? [],
      template: body.template ?? 'openai-compatible',
      status: 'active',
      createdAt: new Date().toISOString(),
    });
  });

  fastify.get('/custom-llm', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      providers: [],
      total: 0,
    });
  });

  fastify.get('/custom-llm/:providerId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as CustomLLMParams;
    return reply.send({
      id: params.providerId,
      name: 'Custom Provider',
      baseUrl: '',
      status: 'active',
    });
  });

  fastify.put('/custom-llm/:providerId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as CustomLLMParams;
    const body = request.body as CustomLLMBody;
    return reply.send({
      id: params.providerId,
      name: body.name ?? 'Updated Provider',
      baseUrl: body.baseUrl ?? '',
      updatedAt: new Date().toISOString(),
    });
  });

  fastify.delete('/custom-llm/:providerId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as CustomLLMParams;
    return reply.send({ deleted: true, providerId: params.providerId });
  });

  fastify.post('/custom-llm/:providerId/test', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as CustomLLMParams;
    return reply.send({
      providerId: params.providerId,
      testResult: 'success',
      latencyMs: 0,
      testedAt: new Date().toISOString(),
    });
  });

  fastify.get('/custom-llm/templates', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      templates: [
        { id: 'openai-compatible', name: 'OpenAI Compatible', description: 'For OpenAI-compatible APIs' },
        { id: 'anthropic-format', name: 'Anthropic Format', description: 'For Anthropic-style APIs' },
        { id: 'ollama-local', name: 'Ollama Local', description: 'For local Ollama instances' },
        { id: 'raw-http', name: 'Raw HTTP', description: 'For custom HTTP endpoints' },
      ],
    });
  });

  fastify.post('/custom-llm/:providerId/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as CustomLLMParams;
    return reply.send({
      providerId: params.providerId,
      valid: true,
      errors: [],
      warnings: [],
    });
  });
}
