export const heartbeatStartSchema = {
  type: 'object',
  properties: {
    worldId: { type: 'string' },
    metrics: { type: 'object' },
    interval: { type: 'number', minimum: 1000, maximum: 60000 },
  },
} as const;

export const heartbeatResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    status: { type: 'string', enum: ['running', 'stopped', 'error'] },
    worldId: { type: 'string' },
    interval: { type: 'number' },
    startedAt: { type: 'string' },
    stoppedAt: { type: 'string' },
  },
} as const;

export const heartbeatVitalsSchema = {
  type: 'object',
  properties: {
    heartbeatId: { type: 'string' },
    vitals: {
      type: 'object',
      properties: {
        cpu: {
          type: 'object',
          properties: {
            value: { type: 'number' },
            unit: { type: 'string' },
            status: { type: 'string', enum: ['normal', 'warning', 'critical'] },
          },
        },
        memory: {
          type: 'object',
          properties: {
            value: { type: 'number' },
            unit: { type: 'string' },
            status: { type: 'string', enum: ['normal', 'warning', 'critical'] },
          },
        },
        latency: {
          type: 'object',
          properties: {
            value: { type: 'number' },
            unit: { type: 'string' },
            status: { type: 'string', enum: ['normal', 'warning', 'critical'] },
          },
        },
        errorRate: {
          type: 'object',
          properties: {
            value: { type: 'number' },
            unit: { type: 'string' },
            status: { type: 'string', enum: ['normal', 'warning', 'critical'] },
          },
        },
        throughput: {
          type: 'object',
          properties: {
            value: { type: 'number' },
            unit: { type: 'string' },
            status: { type: 'string', enum: ['normal', 'warning', 'critical'] },
          },
        },
      },
    },
    timestamp: { type: 'string' },
  },
} as const;

export const heartbeatHistorySchema = {
  type: 'object',
  properties: {
    heartbeatId: { type: 'string' },
    history: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timestamp: { type: 'string' },
          vitals: { type: 'object' },
          anomalies: { type: 'array' },
        },
      },
    },
    total: { type: 'number' },
  },
} as const;

export const heartbeatListSchema = {
  type: 'object',
  properties: {
    heartbeats: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string' },
          worldId: { type: 'string' },
        },
      },
    },
    total: { type: 'number' },
  },
} as const;
