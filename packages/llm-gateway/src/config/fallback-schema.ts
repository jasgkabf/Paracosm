export const fallbackSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "FallbackConfig",
  type: "object",
  properties: {
    version: { type: "number", default: 1 },
    chains: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "name", "modelIds"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          modelIds: { type: "array", items: { type: "string" }, minItems: 1 },
          maxRetries: { type: "number", minimum: 0, default: 3 },
          retryDelayMs: { type: "number", minimum: 100, default: 1000 },
          backoffMultiplier: { type: "number", minimum: 1, default: 2 },
          conditions: { type: "array", items: { type: "string" }, default: [] },
        },
        additionalProperties: false,
      },
      default: [],
    },
    defaultChainId: { type: "string", default: "default" },
    enableAutomaticFallback: { type: "boolean", default: true },
    fallbackOnError: { type: "boolean", default: true },
    fallbackOnTimeout: { type: "boolean", default: true },
    fallbackOnRateLimit: { type: "boolean", default: true },
    fallbackOnContentFilter: { type: "boolean", default: false },
  },
  additionalProperties: false,
} as const;

export interface FallbackSchema {
  version: number;
  chains: {
    id: string;
    name: string;
    modelIds: string[];
    maxRetries: number;
    retryDelayMs: number;
    backoffMultiplier: number;
    conditions: string[];
  }[];
  defaultChainId: string;
  enableAutomaticFallback: boolean;
  fallbackOnError: boolean;
  fallbackOnTimeout: boolean;
  fallbackOnRateLimit: boolean;
  fallbackOnContentFilter: boolean;
}

export function validateFallbackConfig(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (data === null || data === undefined) {
    return { valid: false, errors: ["Fallback config is null or undefined"] };
  }
  if (typeof data !== "object") {
    return { valid: false, errors: ["Fallback config must be an object"] };
  }
  const config = data as Record<string, unknown>;
  if (config.chains !== undefined && !Array.isArray(config.chains)) {
    errors.push("chains must be an array");
  }
  if (config.chains && Array.isArray(config.chains)) {
    const chainIds = new Set<string>();
    for (let i = 0; i < config.chains.length; i++) {
      const chain = config.chains[i] as Record<string, unknown>;
      if (!chain) {
        errors.push(`Chain at index ${i} is null`);
        continue;
      }
      if (typeof chain.id !== "string" || chain.id.length === 0) {
        errors.push(`Chain at index ${i} missing id`);
      }
      if (chainIds.has(chain.id as string)) {
        errors.push(`Duplicate chain id: ${chain.id}`);
      }
      chainIds.add(chain.id as string);
      if (!Array.isArray(chain.modelIds) || chain.modelIds.length === 0) {
        errors.push(`Chain at index ${i} must have at least one modelId`);
      }
      if (chain.maxRetries !== undefined && (typeof chain.maxRetries !== "number" || chain.maxRetries < 0)) {
        errors.push(`Chain at index ${i} maxRetries must be >= 0`);
      }
    }
  }
  if (config.enableAutomaticFallback !== undefined && typeof config.enableAutomaticFallback !== "boolean") {
    errors.push("enableAutomaticFallback must be a boolean");
  }
  if (config.fallbackOnError !== undefined && typeof config.fallbackOnError !== "boolean") {
    errors.push("fallbackOnError must be a boolean");
  }
  if (config.fallbackOnTimeout !== undefined && typeof config.fallbackOnTimeout !== "boolean") {
    errors.push("fallbackOnTimeout must be a boolean");
  }
  return { valid: errors.length === 0, errors };
}

export function getDefaultFallbackConfig(): FallbackSchema {
  return {
    version: 1,
    chains: [],
    defaultChainId: "default",
    enableAutomaticFallback: true,
    fallbackOnError: true,
    fallbackOnTimeout: true,
    fallbackOnRateLimit: true,
    fallbackOnContentFilter: false,
  };
}

export function applyFallbackDefaults(config: Partial<FallbackSchema>): FallbackSchema {
  const defaults = getDefaultFallbackConfig();
  return {
    version: config.version ?? defaults.version,
    chains: (config.chains ?? defaults.chains).map((c) => ({
      ...c,
      maxRetries: c.maxRetries ?? 3,
      retryDelayMs: c.retryDelayMs ?? 1000,
      backoffMultiplier: c.backoffMultiplier ?? 2,
      conditions: c.conditions ?? [],
    })),
    defaultChainId: config.defaultChainId ?? defaults.defaultChainId,
    enableAutomaticFallback: config.enableAutomaticFallback ?? defaults.enableAutomaticFallback,
    fallbackOnError: config.fallbackOnError ?? defaults.fallbackOnError,
    fallbackOnTimeout: config.fallbackOnTimeout ?? defaults.fallbackOnTimeout,
    fallbackOnRateLimit: config.fallbackOnRateLimit ?? defaults.fallbackOnRateLimit,
    fallbackOnContentFilter: config.fallbackOnContentFilter ?? defaults.fallbackOnContentFilter,
  };
}
