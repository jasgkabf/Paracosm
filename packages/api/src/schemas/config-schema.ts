export const configSchema = {
  getProviders: {
    response: {
      200: {
        type: "object" as const,
        properties: {
          success: { type: "boolean" as const },
          data: {
            type: "object" as const,
            properties: {
              items: {
                type: "array" as const,
                items: {
                  type: "object" as const,
                  properties: {
                    providerId: { type: "string" as const },
                    provider: { type: "string" as const },
                    baseUrl: { type: "string" as const },
                    enabled: { type: "boolean" as const },
                    hasApiKey: { type: "boolean" as const },
                    priority: { type: "number" as const },
                  },
                },
              },
              total: { type: "number" as const },
            },
          },
        },
      },
    },
  },

  updateProviders: {
    body: {
      type: "object" as const,
      required: ["providers"],
      properties: {
        providers: {
          type: "array" as const,
          minItems: 1,
          items: {
            type: "object" as const,
            required: ["providerId", "provider"],
            properties: {
              providerId: { type: "string" as const, minLength: 1 },
              provider: { type: "string" as const, enum: ["openai", "anthropic", "google", "mistral", "cohere", "local", "custom"] },
              apiKey: { type: "string" as const },
              baseUrl: { type: "string" as const },
              organizationId: { type: "string" as const },
              defaultModelId: { type: "string" as const },
              rateLimitRpm: { type: "number" as const, minimum: 1 },
              rateLimitTpm: { type: "number" as const, minimum: 1 },
              timeoutMs: { type: "number" as const, minimum: 1000 },
              retries: { type: "number" as const, minimum: 0, maximum: 10 },
              retryDelayMs: { type: "number" as const, minimum: 100 },
              enabled: { type: "boolean" as const },
              priority: { type: "number" as const, minimum: 0 },
            },
          },
        },
      },
    },
  },

  getModels: {
    response: {
      200: {
        type: "object" as const,
        properties: {
          success: { type: "boolean" as const },
          data: {
            type: "object" as const,
            properties: {
              items: {
                type: "array" as const,
                items: {
                  type: "object" as const,
                  properties: {
                    modelId: { type: "string" as const },
                    providerId: { type: "string" as const },
                    temperature: { type: "number" as const },
                    maxTokens: { type: "number" as const },
                  },
                },
              },
              total: { type: "number" as const },
            },
          },
        },
      },
    },
  },

  updateRouting: {
    body: {
      type: "object" as const,
      required: ["routing"],
      properties: {
        routing: {
          type: "object" as const,
          required: ["strategy"],
          properties: {
            strategy: {
              type: "string" as const,
              enum: ["cost_optimized", "performance_optimized", "balanced", "round_robin", "weighted", "adaptive", "context_aware"],
            },
            rules: {
              type: "array" as const,
              items: {
                type: "object" as const,
                properties: {
                  id: { type: "string" as const },
                  name: { type: "string" as const },
                  condition: { type: "string" as const },
                  targetModelId: { type: "string" as const },
                  priority: { type: "number" as const },
                  enabled: { type: "boolean" as const },
                },
              },
            },
            defaultModelId: { type: "string" as const },
            enableCaching: { type: "boolean" as const },
            cacheTtlMs: { type: "number" as const, minimum: 0 },
            maxCacheSize: { type: "number" as const, minimum: 0 },
          },
        },
      },
    },
  },

  updateBudgets: {
    body: {
      type: "object" as const,
      required: ["budgets"],
      properties: {
        budgets: {
          type: "object" as const,
          required: ["dailyLimitUsd", "monthlyLimitUsd", "perRequestLimitUsd"],
          properties: {
            dailyLimitUsd: { type: "number" as const, minimum: 0 },
            monthlyLimitUsd: { type: "number" as const, minimum: 0 },
            perRequestLimitUsd: { type: "number" as const, minimum: 0 },
            alertThresholdPercent: { type: "number" as const, minimum: 0, maximum: 100 },
            enableThrottling: { type: "boolean" as const },
            throttleAtPercent: { type: "number" as const, minimum: 0, maximum: 100 },
          },
        },
      },
    },
  },

  testConnection: {
    body: {
      type: "object" as const,
      required: ["providerId"],
      properties: {
        providerId: { type: "string" as const, minLength: 1 },
        modelId: { type: "string" as const },
        timeout: { type: "number" as const, minimum: 1000, maximum: 60000 },
      },
    },
  },
};
