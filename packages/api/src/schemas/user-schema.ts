export const userCreateSchema = {
  type: 'object',
  required: ['username'],
  properties: {
    username: { type: 'string', minLength: 1, maxLength: 100 },
    email: { type: 'string', format: 'email', maxLength: 255 },
    preferences: { type: 'object' },
  },
} as const;

export const userResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    username: { type: 'string' },
    email: { type: 'string' },
    preferences: { type: 'object' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
} as const;

export const userPreferencesSchema = {
  type: 'object',
  properties: {
    defaultModel: { type: 'string' },
    defaultProvider: { type: 'string' },
    theme: { type: 'string', enum: ['light', 'dark', 'system'] },
    language: { type: 'string' },
    notifications: { type: 'boolean' },
    autoSave: { type: 'boolean' },
  },
} as const;

export const userSessionsSchema = {
  type: 'object',
  properties: {
    userId: { type: 'string' },
    sessions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          createdAt: { type: 'string' },
          lastActivity: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
    },
    total: { type: 'number' },
  },
} as const;
