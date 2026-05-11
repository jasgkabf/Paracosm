import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { generateId, generateUUID, createLogger } from "@paracosm/shared";
import type { ChatMessage, ChatRequest, ChatResponse, StreamEvent, StreamEventType } from "@paracosm/shared";
import { WSManager } from "../websocket/ws-manager.js";
import { chatSchema } from "../schemas/chat-schema.js";

const logger = createLogger("api:routes:chat");

interface ChatBody {
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  context?: Record<string, unknown>;
  sessionId?: string;
}

interface ChatHistoryQuery {
  sessionId?: string;
  limit?: number;
  offset?: number;
}

interface ChatDeleteParams {
  id: string;
}

const conversations = new Map<string, {
  id: string;
  messages: ChatMessage[];
  model: string;
  createdAt: string;
  updatedAt: string;
  sessionId: string;
}>();

export async function registerChatRoutes(fastify: FastifyInstance, wsManager: WSManager): Promise<void> {
  fastify.post<{ Body: ChatBody }>("/chat", {
    schema: chatSchema.sendMessage,
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: ChatBody }>, reply: FastifyReply) => {
    const startTime = Date.now();
    const { messages, model, temperature, maxTokens, stream, context, sessionId } = request.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Messages array must not be empty",
          details: { field: "messages" },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Each message must have role and content",
            details: { field: "messages" },
          },
          meta: { requestId: request.id, timestamp: new Date().toISOString() },
        });
      }
      if (!["user", "assistant", "system"].includes(msg.role)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Message role must be user, assistant, or system",
            details: { field: "messages", value: msg.role },
          },
          meta: { requestId: request.id, timestamp: new Date().toISOString() },
        });
      }
    }

    const conversationId = generateUUID();
    const resolvedSessionId = sessionId ?? generateId();
    const resolvedModel = model ?? "gpt-4o";
    const resolvedTemperature = temperature ?? 0.7;
    const resolvedMaxTokens = maxTokens ?? 4096;

    const chatMessages: ChatMessage[] = messages.map((msg) => ({
      id: generateId(),
      role: msg.role,
      content: msg.content,
      timestamp: new Date().toISOString(),
      metadata: {},
    }));

    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: "assistant",
      content: `Processed ${messages.length} message(s) using ${resolvedModel}. Conversation ${conversationId} created.`,
      timestamp: new Date().toISOString(),
      metadata: {
        model: resolvedModel,
        temperature: resolvedTemperature,
        maxTokens: resolvedMaxTokens,
      },
    };

    chatMessages.push(assistantMessage);

    conversations.set(conversationId, {
      id: conversationId,
      messages: chatMessages,
      model: resolvedModel,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sessionId: resolvedSessionId,
    });

    const response: ChatResponse = {
      id: conversationId,
      requestId: request.id,
      message: assistantMessage,
      model: resolvedModel,
      usage: {
        promptTokens: messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0),
        completionTokens: Math.ceil(assistantMessage.content.length / 4),
        totalTokens: messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0) + Math.ceil(assistantMessage.content.length / 4),
      },
      finishReason: "stop",
      duration: Date.now() - startTime,
    };

    wsManager.broadcast("chat/stream", {
      conversationId,
      sessionId: resolvedSessionId,
      event: "message_complete",
      data: response,
    });

    logger.info("Chat message processed", { conversationId, model: resolvedModel, duration: response.duration });

    return reply.status(200).send({
      success: true,
      data: response,
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
        duration: response.duration,
      },
    });
  });

  fastify.post<{ Body: ChatBody }>("/chat/stream", {
    schema: chatSchema.streamMessage,
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: ChatBody }>, reply: FastifyReply) => {
    const startTime = Date.now();
    const { messages, model, temperature, maxTokens, context, sessionId } = request.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Messages array must not be empty",
          details: { field: "messages" },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    const conversationId = generateUUID();
    const resolvedSessionId = sessionId ?? generateId();
    const resolvedModel = model ?? "gpt-4o";

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const startEvent: StreamEvent = {
      type: "message_start" as StreamEventType,
      data: { messageId: generateId(), model: resolvedModel },
      timestamp: new Date().toISOString(),
      requestId: request.id,
      sequenceNumber: 0,
    };
    reply.raw.write(`data: ${JSON.stringify(startEvent)}\n\n`);

    const fullContent = `Streaming response for conversation ${conversationId} using ${resolvedModel}. Processed ${messages.length} message(s).`;
    const tokens = fullContent.split(" ");
    let seqNum = 1;

    for (let i = 0; i < tokens.length; i++) {
      const tokenEvent: StreamEvent = {
        type: "token" as StreamEventType,
        data: { token: i === tokens.length - 1 ? tokens[i] : tokens[i] + " ", logprob: null },
        timestamp: new Date().toISOString(),
        requestId: request.id,
        sequenceNumber: seqNum++,
      };
      reply.raw.write(`data: ${JSON.stringify(tokenEvent)}\n\n`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    const endEvent: StreamEvent = {
      type: "message_end" as StreamEventType,
      data: {
        messageId: conversationId,
        usage: {
          promptTokens: messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0),
          completionTokens: Math.ceil(fullContent.length / 4),
          totalTokens: messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0) + Math.ceil(fullContent.length / 4),
        },
        finishReason: "stop",
      },
      timestamp: new Date().toISOString(),
      requestId: request.id,
      sequenceNumber: seqNum++,
    };
    reply.raw.write(`data: ${JSON.stringify(endEvent)}\n\n`);

    const doneEvent: StreamEvent = {
      type: "done" as StreamEventType,
      data: { conversationId, duration: Date.now() - startTime },
      timestamp: new Date().toISOString(),
      requestId: request.id,
      sequenceNumber: seqNum,
    };
    reply.raw.write(`data: ${JSON.stringify(doneEvent)}\n\n`);
    reply.raw.end();

    const chatMessages: ChatMessage[] = [
      ...messages.map((msg) => ({
        id: generateId(),
        role: msg.role,
        content: msg.content,
        timestamp: new Date().toISOString(),
        metadata: {},
      })),
      {
        id: generateId(),
        role: "assistant" as const,
        content: fullContent,
        timestamp: new Date().toISOString(),
        metadata: { model: resolvedModel, streamed: true },
      },
    ];

    conversations.set(conversationId, {
      id: conversationId,
      messages: chatMessages,
      model: resolvedModel,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sessionId: resolvedSessionId,
    });

    wsManager.broadcast("chat/stream", {
      conversationId,
      sessionId: resolvedSessionId,
      event: "stream_complete",
      data: { duration: Date.now() - startTime },
    });
  });

  fastify.get<{ Querystring: ChatHistoryQuery }>("/chat/history", {
    schema: chatSchema.getHistory,
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Querystring: ChatHistoryQuery }>, reply: FastifyReply) => {
    const { sessionId, limit = 50, offset = 0 } = request.query;

    let results = Array.from(conversations.values());

    if (sessionId) {
      results = results.filter((c) => c.sessionId === sessionId);
    }

    results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const total = results.length;
    const paginated = results.slice(offset, offset + limit);

    return reply.status(200).send({
      success: true,
      data: {
        items: paginated.map((c) => ({
          id: c.id,
          sessionId: c.sessionId,
          model: c.model,
          messageCount: c.messages.length,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          messages: c.messages,
        })),
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
      },
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.delete<{ Params: ChatDeleteParams }>("/chat/:id", {
    schema: chatSchema.deleteConversation,
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Params: ChatDeleteParams }>, reply: FastifyReply) => {
    const { id } = request.params;

    if (!conversations.has(id)) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Conversation ${id} not found`,
          details: { conversationId: id },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    const conversation = conversations.get(id)!;
    conversations.delete(id);

    wsManager.broadcast("chat/stream", {
      conversationId: id,
      sessionId: conversation.sessionId,
      event: "conversation_deleted",
      data: { conversationId: id },
    });

    logger.info("Conversation deleted", { conversationId: id });

    return reply.status(200).send({
      success: true,
      data: { deleted: true, conversationId: id },
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });
}
