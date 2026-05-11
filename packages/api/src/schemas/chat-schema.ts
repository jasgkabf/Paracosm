const messageSchema = {
  type: "object" as const,
  required: ["role", "content"],
  properties: {
    role: { type: "string" as const, enum: ["user", "assistant", "system"] },
    content: { type: "string" as const, minLength: 1, maxLength: 100000 },
  },
};

export const chatSchema = {
  sendMessage: {
    body: {
      type: "object" as const,
      required: ["messages"],
      properties: {
        messages: {
          type: "array" as const,
          minItems: 1,
          maxItems: 1000,
          items: messageSchema,
        },
        model: { type: "string" as const, maxLength: 100 },
        temperature: { type: "number" as const, minimum: 0, maximum: 2 },
        maxTokens: { type: "number" as const, minimum: 1, maximum: 200000 },
        stream: { type: "boolean" as const },
        context: { type: "object" as const },
        sessionId: { type: "string" as const, maxLength: 256 },
      },
    },
    response: {
      200: {
        type: "object" as const,
        properties: {
          success: { type: "boolean" as const },
          data: {
            type: "object" as const,
            properties: {
              id: { type: "string" as const },
              requestId: { type: "string" as const },
              message: {
                type: "object" as const,
                properties: {
                  id: { type: "string" as const },
                  role: { type: "string" as const },
                  content: { type: "string" as const },
                  timestamp: { type: "string" as const },
                  metadata: { type: "object" as const },
                },
              },
              model: { type: "string" as const },
              usage: {
                type: "object" as const,
                properties: {
                  promptTokens: { type: "number" as const },
                  completionTokens: { type: "number" as const },
                  totalTokens: { type: "number" as const },
                },
              },
              finishReason: { type: "string" as const },
              duration: { type: "number" as const },
            },
          },
          meta: {
            type: "object" as const,
            properties: {
              requestId: { type: "string" as const },
              timestamp: { type: "string" as const },
              duration: { type: "number" as const },
            },
          },
        },
      },
    },
  },

  streamMessage: {
    body: {
      type: "object" as const,
      required: ["messages"],
      properties: {
        messages: {
          type: "array" as const,
          minItems: 1,
          maxItems: 1000,
          items: messageSchema,
        },
        model: { type: "string" as const, maxLength: 100 },
        temperature: { type: "number" as const, minimum: 0, maximum: 2 },
        maxTokens: { type: "number" as const, minimum: 1, maximum: 200000 },
        context: { type: "object" as const },
        sessionId: { type: "string" as const, maxLength: 256 },
      },
    },
  },

  getHistory: {
    querystring: {
      type: "object" as const,
      properties: {
        sessionId: { type: "string" as const, maxLength: 256 },
        limit: { type: "number" as const, minimum: 1, maximum: 1000, default: 50 },
        offset: { type: "number" as const, minimum: 0, default: 0 },
      },
    },
  },

  deleteConversation: {
    params: {
      type: "object" as const,
      required: ["id"],
      properties: {
        id: { type: "string" as const, minLength: 1 },
      },
    },
  },
};
