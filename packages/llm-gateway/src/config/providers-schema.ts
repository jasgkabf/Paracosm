export const providersSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "ProvidersConfig",
  type: "object",
  required: ["providers"],
  properties: {
    version: { type: "number", default: 1 },
    providers: {
      type: "array",
      items: {
        type: "object",
        required: ["providerId", "provider", "apiKey", "baseUrl"],
        properties: {
          providerId: { type: "string", minLength: 1 },
          provider: {
            type: "string",
            enum: ["openai", "anthropic", "google", "mistral", "cohere", "local", "custom"],
          },
          apiKey: { type: "string", minLength: 1 },
          baseUrl: { type: "string", format: "uri" },
          organizationId: { type: ["string", "null"] },
          defaultModelId: { type: ["string", "null"] },
          rateLimitRpm: { type: "number", minimum: 1, default: 500 },
          rateLimitTpm: { type: "number", minimum: 1, default: 200000 },
          timeoutMs: { type: "number", minimum: 1000, default: 30000 },
          retries: { type: "number", minimum: 0, maximum: 10, default: 3 },
          retryDelayMs: { type: "number", minimum: 100, default: 1000 },
          enabled: { type: "boolean", default: true },
          priority: { type: "number", minimum: 0, default: 1 },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const;

export interface ProvidersSchema {
  version: number;
  providers: {
    providerId: string;
    provider: string;
    apiKey: string;
    baseUrl: string;
    organizationId: string | null;
    defaultModelId: string | null;
    rateLimitRpm: number;
    rateLimitTpm: number;
    timeoutMs: number;
    retries: number;
    retryDelayMs: number;
    enabled: boolean;
    priority: number;
  }[];
}

export function validateProvidersConfig(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (data === null || data === undefined) {
    return { valid: false, errors: ["Providers config is null or undefined"] };
  }
  if (typeof data !== "object") {
    return { valid: false, errors: ["Providers config must be an object"] };
  }
  const config = data as Record<string, unknown>;
  if (!Array.isArray(config.providers)) {
    return { valid: false, errors: ["providers must be an array"] };
  }
  const providerIds = new Set<string>();
  for (let i = 0; i < config.providers.length; i++) {
    const provider = config.providers[i] as Record<string, unknown>;
    if (!provider) {
      errors.push(`Provider at index ${i} is null`);
      continue;
    }
    if (typeof provider.providerId !== "string" || provider.providerId.length === 0) {
      errors.push(`Provider at index ${i} missing providerId`);
    }
    if (providerIds.has(provider.providerId as string)) {
      errors.push(`Duplicate providerId: ${provider.providerId}`);
    }
    providerIds.add(provider.providerId as string);
    if (typeof provider.provider !== "string" || provider.provider.length === 0) {
      errors.push(`Provider at index ${i} missing provider type`);
    }
    if (typeof provider.apiKey !== "string" || provider.apiKey.length === 0) {
      errors.push(`Provider at index ${i} missing apiKey`);
    }
    if (typeof provider.baseUrl !== "string" || provider.baseUrl.length === 0) {
      errors.push(`Provider at index ${i} missing baseUrl`);
    }
    if (provider.timeoutMs !== undefined && (typeof provider.timeoutMs !== "number" || provider.timeoutMs < 1000)) {
      errors.push(`Provider at index ${i} timeoutMs must be >= 1000`);
    }
    if (provider.retries !== undefined && (typeof provider.retries !== "number" || provider.retries < 0 || provider.retries > 10)) {
      errors.push(`Provider at index ${i} retries must be 0-10`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function getDefaultProvidersConfig(): ProvidersSchema {
  return {
    version: 1,
    providers: [],
  };
}

export function applyProvidersDefaults(config: Partial<ProvidersSchema>): ProvidersSchema {
  const defaults = getDefaultProvidersConfig();
  return {
    version: config.version ?? defaults.version,
    providers: (config.providers ?? defaults.providers).map((p) => ({
      ...p,
      rateLimitRpm: p.rateLimitRpm ?? 500,
      rateLimitTpm: p.rateLimitTpm ?? 200000,
      timeoutMs: p.timeoutMs ?? 30000,
      retries: p.retries ?? 3,
      retryDelayMs: p.retryDelayMs ?? 1000,
      enabled: p.enabled ?? true,
      priority: p.priority ?? 1,
      organizationId: p.organizationId ?? null,
      defaultModelId: p.defaultModelId ?? null,
    })),
  };
}
