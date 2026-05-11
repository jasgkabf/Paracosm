export const customLLMSchema = {
  getTemplates: {
    response: {
      200: {
        type: "object" as const,
        properties: {
          success: { type: "boolean" as const },
          data: {
            type: "object" as const,
            properties: {
              items: { type: "array" as const },
              total: { type: "number" as const },
            },
          },
        },
      },
    },
  },

  createProvider: {
    body: {
      type: "object" as const,
      required: ["config"],
      properties: {
        config: {
          type: "object" as const,
          required: ["name", "baseUrl"],
          properties: {
            providerId: { type: "string" as const },
            name: { type: "string" as const, minLength: 1, maxLength: 100 },
            description: { type: "string" as const, maxLength: 500 },
            baseUrl: { type: "string" as const, minLength: 1 },
            authentication: {
              type: "object" as const,
              properties: {
                type: { type: "string" as const, enum: ["bearer", "api_key", "basic", "custom"] },
                headerName: { type: "string" as const },
                tokenTemplate: { type: "string" as const },
              },
            },
            rateLimitRpm: { type: "number" as const, minimum: 1 },
            timeoutMs: { type: "number" as const, minimum: 1000 },
          },
        },
        templateId: { type: "string" as const },
      },
    },
  },

  updateProvider: {
    params: {
      type: "object" as const,
      required: ["id"],
      properties: {
        id: { type: "string" as const, minLength: 1 },
      },
    },
    body: {
      type: "object" as const,
      required: ["config"],
      properties: {
        config: { type: "object" as const },
      },
    },
  },

  deleteProvider: {
    params: {
      type: "object" as const,
      required: ["id"],
      properties: {
        id: { type: "string" as const, minLength: 1 },
      },
    },
  },

  testProvider: {
    body: {
      type: "object" as const,
      required: ["providerId"],
      properties: {
        providerId: { type: "string" as const, minLength: 1 },
        prompt: { type: "string" as const, maxLength: 10000 },
        timeout: { type: "number" as const, minimum: 1000, maximum: 60000 },
      },
    },
  },

  validateProvider: {
    body: {
      type: "object" as const,
      required: ["config"],
      properties: {
        config: { type: "object" as const },
      },
    },
  },
};
