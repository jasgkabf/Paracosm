export const customLLMCreateSchema = {
  type: 'object',
  required: ['name', 'baseUrl'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 200 },
    baseUrl: { type: 'string', minLength: 1, format: 'uri' },
    apiKey: { type: 'string' },
    headers: { type: 'object', additionalProperties: { type: 'string' } },
    requestMapping: { type: 'object' },
    responseMapping: { type: 'object' },
    supportedModels: { type: 'array', items: { type: 'string' } },
    template: {
      type: 'string',
      enum: ['openai-compatible', 'anthropic-format', 'ollama-local', 'raw-http'],
    },
  },
} as const;

export const customLLMResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    baseUrl: { type: 'string' },
    headers: { type: 'object' },
    requestMapping: { type: 'object' },
    responseMapping: { type: 'object' },
    supportedModels: { type: 'array', items: { type: 'string' } },
    template: { type: 'string' },
    status: { type: 'string', enum: ['active', 'inactive', 'error'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
} as const;

export const customLLMTestSchema = {
  type: 'object',
  properties: {
    providerId: { type: 'string' },
    testResult: { type: 'string', enum: ['success', 'failure'] },
    latencyMs: { type: 'number' },
    error: { type: 'string' },
    testedAt: { type: 'string' },
  },
} as const;

export const customLLMTemplateSchema = {
  type: 'object',
  properties: {
    templates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
  },
} as const;

export const customLLMValidateSchema = {
  type: 'object',
  properties: {
    providerId: { type: 'string' },
    valid: { type: 'boolean' },
    errors: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
} as const;

export const customLLMListSchema = {
  type: 'object',
  properties: {
    providers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
    total: { type: 'number' },
  },
} as const;
