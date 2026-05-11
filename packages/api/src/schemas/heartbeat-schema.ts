export const heartbeatSchema = {
  getLive: {
    response: {
      200: {
        content: { "text/event-stream": {} },
      },
    },
  },

  getStatus: {
    response: {
      200: {
        type: "object" as const,
        properties: {
          success: { type: "boolean" as const },
          data: {
            type: "object" as const,
            properties: {
              state: {
                type: "object" as const,
                properties: {
                  phase: { type: "string" as const },
                  bpm: { type: "number" as const },
                  rhythm: { type: "string" as const },
                  beatCount: { type: "number" as const },
                  uptime: { type: "number" as const },
                },
              },
              vitals: { type: "object" as const },
              systemMetrics: { type: "object" as const },
              timestamp: { type: "string" as const },
            },
          },
        },
      },
    },
  },

  getHistory: {
    querystring: {
      type: "object" as const,
      properties: {
        limit: { type: "number" as const, minimum: 1, maximum: 1000, default: 50 },
        offset: { type: "number" as const, minimum: 0, default: 0 },
        severity: { type: "string" as const, enum: ["info", "warning", "critical"] },
      },
    },
  },

  getEngines: {
    response: {
      200: {
        type: "object" as const,
        properties: {
          success: { type: "boolean" as const },
          data: {
            type: "object" as const,
            properties: {
              engines: { type: "array" as const },
              total: { type: "number" as const },
              healthy: { type: "number" as const },
              unhealthy: { type: "number" as const },
            },
          },
        },
      },
    },
  },

  getProviders: {
    response: {
      200: {
        type: "object" as const,
        properties: {
          success: { type: "boolean" as const },
          data: {
            type: "object" as const,
            properties: {
              providers: { type: "array" as const },
              total: { type: "number" as const },
              available: { type: "number" as const },
              unavailable: { type: "number" as const },
            },
          },
        },
      },
    },
  },
};
