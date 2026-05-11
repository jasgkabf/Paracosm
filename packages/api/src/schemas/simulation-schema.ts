export const simulationRunSchema = {
  type: 'object',
  required: ['worldId', 'scenario'],
  properties: {
    worldId: { type: 'string', minLength: 1 },
    scenario: { type: 'string', minLength: 1, maxLength: 10000 },
    parameters: { type: 'object' },
    maxDepth: { type: 'number', minimum: 1, maximum: 100 },
    iterations: { type: 'number', minimum: 1, maximum: 100000 },
  },
} as const;

export const simulationResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    worldId: { type: 'string' },
    scenario: { type: 'string' },
    status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] },
    results: {
      type: 'object',
      properties: {
        paths: { type: 'array' },
        scores: { type: 'array' },
        bestPath: { type: 'object' },
      },
    },
    iterations: { type: 'number' },
    durationMs: { type: 'number' },
    createdAt: { type: 'string' },
  },
} as const;

export const simulationResultsSchema = {
  type: 'object',
  properties: {
    simulationId: { type: 'string' },
    paths: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          steps: { type: 'array' },
          score: { type: 'number' },
        },
      },
    },
    scores: { type: 'array', items: { type: 'number' } },
    bestPath: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        score: { type: 'number' },
      },
      nullable: true,
    },
  },
} as const;

export const simulationMCTSSchema = {
  type: 'object',
  required: ['worldId'],
  properties: {
    worldId: { type: 'string' },
    scenario: { type: 'string' },
    parameters: { type: 'object' },
    maxDepth: { type: 'number' },
    iterations: { type: 'number' },
  },
} as const;

export const simulationListSchema = {
  type: 'object',
  properties: {
    simulations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string' },
          createdAt: { type: 'string' },
        },
      },
    },
    total: { type: 'number' },
  },
} as const;
