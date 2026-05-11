import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AgentEngine } from '../agent/agent-engine.js';
import type { LLMConfig } from '../agent/config-store.js';

interface UpdateConfigBody {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function registerLLMConfigRoutes(fastify: FastifyInstance, agentEngine: AgentEngine): void {
  const configStore = agentEngine.getConfigStore();

  fastify.get('/llm-config', async (_request: FastifyRequest, reply: FastifyReply) => {
    const config = configStore.getConfig();
    return reply.send({
      configured: configStore.isConfigured(),
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
    });
  });

  fastify.put('/llm-config', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as UpdateConfigBody;

    if (!body.apiKey && !body.baseUrl && !body.model) {
      return reply.status(400).send({ error: 'At least one of apiKey, baseUrl, or model is required' });
    }

    const update: Partial<LLMConfig> = {};
    if (body.apiKey !== undefined) update.apiKey = body.apiKey;
    if (body.baseUrl !== undefined) update.baseUrl = body.baseUrl;
    if (body.model !== undefined) update.model = body.model;

    const saved = configStore.saveConfig(update);
    agentEngine.reconfigureProvider();

    return reply.send({
      updated: true,
      configured: configStore.isConfigured(),
      apiKey: saved.apiKey,
      baseUrl: saved.baseUrl,
      model: saved.model,
      updatedAt: new Date().toISOString(),
    });
  });

  fastify.post('/llm-config/test', async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await configStore.testConnection();
    return reply.send(result);
  });

  fastify.delete('/llm-config', async (_request: FastifyRequest, reply: FastifyReply) => {
    configStore.deleteConfig();
    agentEngine.reconfigureProvider();
    return reply.send({
      deleted: true,
      configured: false,
      message: 'LLM configuration has been reset',
      timestamp: new Date().toISOString(),
    });
  });
}
