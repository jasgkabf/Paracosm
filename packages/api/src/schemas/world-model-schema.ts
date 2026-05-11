export const worldModelSchema = {
  getStatus: {
    response: {
      200: {
        type: "object" as const,
        properties: {
          success: { type: "boolean" as const },
          data: {
            type: "object" as const,
            properties: {
              status: { type: "string" as const },
              version: { type: "number" as const },
              lastUpdated: { type: "string" as const },
              entityCount: { type: "number" as const },
              relationCount: { type: "number" as const },
              eventCount: { type: "number" as const },
              constraintCount: { type: "number" as const },
              goalCount: { type: "number" as const },
              uptime: { type: "number" as const },
              timestamp: { type: "string" as const },
            },
          },
        },
      },
    },
  },

  getEntities: {
    querystring: {
      type: "object" as const,
      properties: {
        type: { type: "string" as const, enum: ["agent", "resource", "location", "event", "concept", "organization", "artifact", "process"] },
        limit: { type: "number" as const, minimum: 1, maximum: 1000, default: 50 },
        offset: { type: "number" as const, minimum: 0, default: 0 },
      },
    },
  },

  getTimeline: {
    querystring: {
      type: "object" as const,
      properties: {
        start: { type: "string" as const, format: "date-time" },
        end: { type: "string" as const, format: "date-time" },
        limit: { type: "number" as const, minimum: 1, maximum: 1000, default: 50 },
        offset: { type: "number" as const, minimum: 0, default: 0 },
      },
    },
  },

  getConstraints: {
    querystring: {
      type: "object" as const,
      properties: {
        status: { type: "string" as const, enum: ["active", "violated", "satisfied", "relaxed"] },
        type: { type: "string" as const, enum: ["hard", "soft", "preference", "resource", "temporal", "logical"] },
        limit: { type: "number" as const, minimum: 1, maximum: 1000, default: 50 },
        offset: { type: "number" as const, minimum: 0, default: 0 },
      },
    },
  },

  getGoals: {
    querystring: {
      type: "object" as const,
      properties: {
        state: { type: "string" as const, enum: ["pending", "active", "in_progress", "completed", "failed", "deferred", "cancelled"] },
        priority: { type: "number" as const, minimum: 0, maximum: 4 },
        limit: { type: "number" as const, minimum: 1, maximum: 1000, default: 50 },
        offset: { type: "number" as const, minimum: 0, default: 0 },
      },
    },
  },

  queryWorld: {
    body: {
      type: "object" as const,
      required: ["query"],
      properties: {
        query: { type: "string" as const, minLength: 1, maxLength: 10000 },
        filters: { type: "object" as const },
        depth: { type: "number" as const, minimum: 1, maximum: 10, default: 1 },
      },
    },
  },
};
