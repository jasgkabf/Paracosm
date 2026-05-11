import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface ToolBody {
  name: string;
  type: string;
  description?: string;
  parameters?: Record<string, unknown>;
  permissions?: string[];
}

interface ToolParams {
  toolId: string;
}

export function registerToolRoutes(fastify: FastifyInstance): void {
  fastify.get('/tools', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      tools: [
        { id: 'web_search', name: 'Web Search', type: 'builtin', description: 'Search the web' },
        { id: 'code_executor', name: 'Code Executor', type: 'builtin', description: 'Execute code snippets' },
        { id: 'file_ops', name: 'File Operations', type: 'builtin', description: 'Read and write files' },
        { id: 'api_caller', name: 'API Caller', type: 'builtin', description: 'Make HTTP requests' },
        { id: 'shell_executor', name: 'Shell Executor', type: 'builtin', description: 'Execute shell commands' },
        { id: 'data_processor', name: 'Data Processor', type: 'builtin', description: 'Process and transform data' },
        { id: 'system_info', name: 'System Info', type: 'builtin', description: 'Get system information' },
      ],
      total: 7,
    });
  });

  fastify.get('/tools/:toolId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as ToolParams;
    return reply.send({
      id: params.toolId,
      name: 'Tool',
      type: 'builtin',
      description: 'A tool',
      parameters: {},
      permissions: [],
    });
  });

  fastify.post('/tools/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as ToolBody;

    if (!body.name || !body.type) {
      return reply.status(400).send({ error: 'name and type are required' });
    }

    return reply.send({
      id: `tool_${Date.now()}`,
      name: body.name,
      type: body.type,
      description: body.description ?? '',
      parameters: body.parameters ?? {},
      permissions: body.permissions ?? [],
      registeredAt: new Date().toISOString(),
    });
  });

  fastify.post('/tools/:toolId/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as ToolParams;
    const body = request.body as { input?: unknown };
    return reply.send({
      toolId: params.toolId,
      output: null,
      status: 'completed',
      executedAt: new Date().toISOString(),
    });
  });

  fastify.delete('/tools/:toolId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as ToolParams;
    return reply.send({ deleted: true, toolId: params.toolId });
  });

  fastify.get('/tools/plugins', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      plugins: [],
      total: 0,
    });
  });

  fastify.post('/tools/plugins/install', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { name: string; source?: string };
    return reply.send({
      id: `plugin_${Date.now()}`,
      name: body.name,
      status: 'installed',
      installedAt: new Date().toISOString(),
    });
  });
}
