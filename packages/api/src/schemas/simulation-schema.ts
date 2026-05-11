export const simulationSchema = {
  startSimulation: {
    body: {
      type: "object" as const,
      properties: {
        config: {
          type: "object" as const,
          properties: {
            maxSteps: { type: "number" as const, minimum: 1, maximum: 10000 },
            maxPaths: { type: "number" as const, minimum: 1, maximum: 100 },
            timeLimitMs: { type: "number" as const, minimum: 1000, maximum: 3600000 },
            branchFactor: { type: "number" as const, minimum: 1, maximum: 10 },
            pruningThreshold: { type: "number" as const, minimum: 0, maximum: 1 },
            explorationRate: { type: "number" as const, minimum: 0, maximum: 1 },
            seed: { type: "number" as const },
            snapshotInterval: { type: "number" as const, minimum: 1 },
            parallelPaths: { type: "number" as const, minimum: 1, maximum: 16 },
            earlyTermination: { type: "boolean" as const },
            earlyTerminationThreshold: { type: "number" as const, minimum: 0, maximum: 1 },
          },
        },
        query: { type: "string" as const, maxLength: 10000 },
        context: { type: "object" as const },
      },
    },
  },

  getSimulation: {
    params: {
      type: "object" as const,
      required: ["id"],
      properties: {
        id: { type: "string" as const, minLength: 1 },
      },
    },
  },

  getHistory: {
    querystring: {
      type: "object" as const,
      properties: {
        status: { type: "string" as const, enum: ["queued", "running", "paused", "completed", "failed", "cancelled"] },
        limit: { type: "number" as const, minimum: 1, maximum: 1000, default: 50 },
        offset: { type: "number" as const, minimum: 0, default: 0 },
      },
    },
  },

  cancelSimulation: {
    body: {
      type: "object" as const,
      properties: {
        simulationId: { type: "string" as const, minLength: 1 },
        reason: { type: "string" as const, maxLength: 1000 },
      },
    },
  },
};
