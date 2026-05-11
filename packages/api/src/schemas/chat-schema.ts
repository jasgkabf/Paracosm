export const chatRequestSchema = {
  type: 'object',
  required: ['message'],
  properties: {
    message: { type: 'string', minLength: 1, maxLength: 100000 },
    context: { type: 'array', items: { type: 'string' } },
    personas: { type: 'array', items: { type: 'string' } },
    stream: { type: 'boolean' },
    temperature: { type: 'number', minimum: 0, maximum: 2 },
    maxTokens: { type: 'number', minimum: 1, maximum: 128000 },
    model: { type: 'string' },
    provider: { type: 'string' },
  },
} as const;

export const chatResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    message: { type: 'string' },
    response: { type: 'string' },
    model: { type: 'string' },
    provider: { type: 'string' },
    usage: {
      type: 'object',
      properties: {
        promptTokens: { type: 'number' },
        completionTokens: { type: 'number' },
        totalTokens: { type: 'number' },
      },
    },
    timestamp: { type: 'string' },
  },
} as const;

export const chatHistorySchema = {
  type: 'object',
  properties: {
    sessionId: { type: 'string' },
    messages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          content: { type: 'string' },
          timestamp: { type: 'string' },
        },
      },
    },
    total: { type: 'number' },
  },
} as const;

export const chatModelsSchema = {
  type: 'object',
  properties: {
    models: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          provider: { type: 'string' },
          capabilities: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;

export const chatCompletionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    object: { type: 'string' },
    choices: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'number' },
          message: {
            type: 'object',
            properties: {
              role: { type: 'string' },
              content: { type: 'string' },
            },
          },
          finishReason: { type: 'string' },
        },
      },
    },
    usage: {
      type: 'object',
      properties: {
        promptTokens: { type: 'number' },
        completionTokens: { type: 'number' },
        totalTokens: { type: 'number' },
      },
    },
  },
} as const;
