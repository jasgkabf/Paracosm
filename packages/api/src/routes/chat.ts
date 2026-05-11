import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AgentEngine } from '../agent/agent-engine.js';

interface ChatRequestBody {
  message: string;
  stream?: boolean;
  history?: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  provider?: string;
}

interface ChatHistoryParams {
  sessionId: string;
}

export function registerChatRoutes(fastify: FastifyInstance, agentEngine: AgentEngine): void {
  fastify.post('/chat', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as ChatRequestBody;

    if (!body.message) {
      return reply.status(400).send({ error: 'Message is required' });
    }

    const response = await agentEngine.processMessage(body.message, body.history ?? []);

    return reply.send({
      id: response.id,
      message: body.message,
      response: response.content,
      toolCalls: response.toolCalls,
      model: response.model,
      usage: response.usage,
      timestamp: response.timestamp,
    });
  });

  fastify.post('/chat/stream', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as ChatRequestBody;

    if (!body.message) {
      return reply.status(400).send({ error: 'Message is required' });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    try {
      for await (const event of agentEngine.streamMessage(body.message, body.history ?? [])) {
        if (event.type === 'token') {
          reply.raw.write(`data: ${JSON.stringify({ type: 'token', data: event.data })}\n\n`);
        } else if (event.type === 'tool_call') {
          reply.raw.write(`data: ${JSON.stringify({ type: 'tool_call', data: event.data })}\n\n`);
        } else if (event.type === 'tool_result') {
          reply.raw.write(`data: ${JSON.stringify({ type: 'tool_result', data: event.data })}\n\n`);
        } else if (event.type === 'error') {
          reply.raw.write(`data: ${JSON.stringify({ type: 'error', data: event.data })}\n\n`);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', data: msg })}\n\n`);
    }

    reply.raw.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
    reply.raw.end();
  });

  fastify.get('/chat/history/:sessionId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as ChatHistoryParams;
    return reply.send({
      sessionId: params.sessionId,
      messages: [],
      total: 0,
    });
  });

  fastify.delete('/chat/history/:sessionId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as ChatHistoryParams;
    return reply.send({ deleted: true, sessionId: params.sessionId });
  });

  fastify.get('/chat/models', async (_request: FastifyRequest, reply: FastifyReply) => {
    const config = agentEngine.getConfigStore().getRawConfig();
    if (config.model) {
      return reply.send({
        models: [
          { id: config.model, provider: 'custom', capabilities: ['chat', 'streaming', 'function_calling'] },
        ],
      });
    }
    return reply.send({ models: [] });
  });

  fastify.post('/chat/completions', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as ChatRequestBody;

    if (!body.message) {
      return reply.status(400).send({ error: 'Message is required' });
    }

    const response = await agentEngine.processMessage(body.message, body.history ?? []);

    return reply.send({
      id: response.id,
      object: 'chat.completion',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: response.content },
          finishReason: response.toolCalls.length > 0 ? 'tool_calls' : 'stop',
        },
      ],
      toolCalls: response.toolCalls,
      usage: response.usage,
      model: response.model,
    });
  });
}
