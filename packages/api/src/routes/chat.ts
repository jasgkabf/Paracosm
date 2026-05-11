import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface ChatRequestBody {
  message: string;
  context?: string[];
  personas?: string[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  provider?: string;
}

interface ChatHistoryParams {
  sessionId: string;
}

export function registerChatRoutes(fastify: FastifyInstance): void {
  fastify.post('/chat', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as ChatRequestBody;

    if (!body.message) {
      return reply.status(400).send({ error: 'Message is required' });
    }

    const response = {
      id: `chat_${Date.now()}`,
      message: body.message,
      response: `Processed: ${body.message}`,
      model: body.model ?? 'default',
      provider: body.provider ?? 'default',
      usage: {
        promptTokens: Math.ceil(body.message.length / 4),
        completionTokens: 0,
        totalTokens: Math.ceil(body.message.length / 4),
      },
      timestamp: new Date().toISOString(),
    };

    return reply.send(response);
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

    const words = body.message.split(' ');
    for (const word of words) {
      reply.raw.write(`data: ${JSON.stringify({ type: 'token', data: word })}\n\n`);
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
    return reply.send({
      models: [
        { id: 'gpt-4o', provider: 'openai', capabilities: ['chat', 'streaming', 'function_calling'] },
        { id: 'claude-3-5-sonnet-20241022', provider: 'anthropic', capabilities: ['chat', 'streaming'] },
        { id: 'gemini-1.5-pro', provider: 'google', capabilities: ['chat', 'streaming', 'vision'] },
      ],
    });
  });

  fastify.post('/chat/completions', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as ChatRequestBody;

    if (!body.message) {
      return reply.status(400).send({ error: 'Message is required' });
    }

    return reply.send({
      id: `comp_${Date.now()}`,
      object: 'chat.completion',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: `Completion for: ${body.message}` },
          finishReason: 'stop',
        },
      ],
      usage: {
        promptTokens: Math.ceil(body.message.length / 4),
        completionTokens: 10,
        totalTokens: Math.ceil(body.message.length / 4) + 10,
      },
    });
  });
}
