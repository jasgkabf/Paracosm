export const llmConfigSchema = {
  type: 'object',
  properties: {
    defaultProvider: { type: 'string' },
    defaultModel: { type: 'string' },
    providers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          models: { type: 'array', items: { type: 'string' } },
          enabled: { type: 'boolean' },
        },
      },
    },
    routing: {
      type: 'object',
      properties: {
        strategy: {
          type: 'string',
          enum: ['round_robin', 'least_latency', 'cost_optimized', 'quality_optimized', 'adaptive', 'manual'],
        },
      },
    },
    budget: {
      type: 'object',
      properties: {
        dailyLimit: { type: 'number', minimum: 0 },
        monthlyLimit: { type: 'number', minimum: 0 },
      },
    },
  },
} as const;

export const llmProviderSchema = {
  type: 'object',
  required: ['provider'],
  properties: {
    provider: { type: 'string', minLength: 1 },
    model: { type: 'string' },
    apiKey: { type: 'string' },
    baseUrl: { type: 'string' },
    enabled: { type: 'boolean' },
    maxConcurrentRequests: { type: 'number', minimum: 1 },
    timeout: { type: 'number', minimum: 1000 },
  },
} as const;

export const llmRoutingSchema = {
  type: 'object',
  properties: {
    strategy: {
      type: 'string',
      enum: ['round_robin', 'least_latency', 'cost_optimized', 'quality_optimized', 'adaptive', 'manual'],
    },
    rules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          condition: { type: 'string' },
          provider: { type: 'string' },
          model: { type: 'string' },
          priority: { type: 'number' },
          enabled: { type: 'boolean' },
        },
      },
    },
  },
} as const;

export const llmBudgetSchema = {
  type: 'object',
  properties: {
    dailyLimit: { type: 'number', minimum: 0 },
    monthlyLimit: { type: 'number', minimum: 0 },
    perRequestLimit: { type: 'number', minimum: 0 },
    alertThreshold: { type: 'number', minimum: 0, maximum: 1 },
    currency: { type: 'string' },
  },
} as const;

export const llmProvidersListSchema = {
  type: 'object',
  properties: {
    providers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          enabled: { type: 'boolean' },
          models: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;
