export const worldModelCreateSchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 500 },
    description: { type: 'string', maxLength: 5000 },
    entities: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'type'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string' },
        },
      },
    },
    relations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['source', 'target', 'type'],
        properties: {
          source: { type: 'string' },
          target: { type: 'string' },
          type: { type: 'string' },
        },
      },
    },
    constraints: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'type'],
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          value: {},
        },
      },
    },
  },
} as const;

export const worldModelResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    entityCount: { type: 'number' },
    relationCount: { type: 'number' },
    constraintCount: { type: 'number' },
    createdAt: { type: 'string' },
  },
} as const;

export const worldModelEntitySchema = {
  type: 'object',
  required: ['name', 'type'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 200 },
    type: { type: 'string', minLength: 1, maxLength: 100 },
    properties: { type: 'object' },
  },
} as const;

export const worldModelGraphSchema = {
  type: 'object',
  properties: {
    worldId: { type: 'string' },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          type: { type: 'string' },
        },
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          source: { type: 'string' },
          target: { type: 'string' },
          label: { type: 'string' },
        },
      },
    },
  },
} as const;

export const worldModelListSchema = {
  type: 'object',
  properties: {
    worlds: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          createdAt: { type: 'string' },
        },
      },
    },
    total: { type: 'number' },
  },
} as const;
