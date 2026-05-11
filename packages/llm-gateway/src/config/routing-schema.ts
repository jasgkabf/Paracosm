export const routingSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "RoutingConfig",
  type: "object",
  required: ["strategy"],
  properties: {
    version: { type: "number", default: 1 },
    strategy: {
      type: "string",
      enum: ["cost_optimized", "performance_optimized", "balanced", "round_robin", "weighted", "adaptive", "context_aware"],
      default: "balanced",
    },
    rules: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "name", "condition", "targetModelId"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          condition: { type: "string", minLength: 1 },
          targetModelId: { type: "string", minLength: 1 },
          priority: { type: "number", minimum: 0, default: 0 },
          enabled: { type: "boolean", default: true },
          metadata: { type: "object", default: {} },
        },
        additionalProperties: false,
      },
      default: [],
    },
    defaultModelId: { type: ["string", "null"] },
    enableCaching: { type: "boolean", default: true },
    cacheTtlMs: { type: "number", minimum: 0, default: 300000 },
    maxCacheSize: { type: "number", minimum: 1, default: 1000 },
  },
  additionalProperties: false,
} as const;

export interface RoutingSchema {
  version: number;
  strategy: string;
  rules: {
    id: string;
    name: string;
    condition: string;
    targetModelId: string;
    priority: number;
    enabled: boolean;
    metadata: Record<string, unknown>;
  }[];
  defaultModelId: string | null;
  enableCaching: boolean;
  cacheTtlMs: number;
  maxCacheSize: number;
}

export function validateRoutingConfig(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (data === null || data === undefined) {
    return { valid: false, errors: ["Routing config is null or undefined"] };
  }
  if (typeof data !== "object") {
    return { valid: false, errors: ["Routing config must be an object"] };
  }
  const config = data as Record<string, unknown>;
  const validStrategies = ["cost_optimized", "performance_optimized", "balanced", "round_robin", "weighted", "adaptive", "context_aware"];
  if (typeof config.strategy !== "string" || !validStrategies.includes(config.strategy)) {
    errors.push(`Invalid strategy: ${config.strategy}. Must be one of: ${validStrategies.join(", ")}`);
  }
  if (config.rules !== undefined && !Array.isArray(config.rules)) {
    errors.push("rules must be an array");
  }
  if (config.rules && Array.isArray(config.rules)) {
    const ruleIds = new Set<string>();
    for (let i = 0; i < config.rules.length; i++) {
      const rule = config.rules[i] as Record<string, unknown>;
      if (!rule) {
        errors.push(`Rule at index ${i} is null`);
        continue;
      }
      if (typeof rule.id !== "string" || rule.id.length === 0) {
        errors.push(`Rule at index ${i} missing id`);
      }
      if (ruleIds.has(rule.id as string)) {
        errors.push(`Duplicate rule id: ${rule.id}`);
      }
      ruleIds.add(rule.id as string);
      if (typeof rule.condition !== "string" || rule.condition.length === 0) {
        errors.push(`Rule at index ${i} missing condition`);
      }
    }
  }
  if (config.cacheTtlMs !== undefined && (typeof config.cacheTtlMs !== "number" || config.cacheTtlMs < 0)) {
    errors.push("cacheTtlMs must be a non-negative number");
  }
  if (config.maxCacheSize !== undefined && (typeof config.maxCacheSize !== "number" || config.maxCacheSize < 1)) {
    errors.push("maxCacheSize must be >= 1");
  }
  return { valid: errors.length === 0, errors };
}

export function getDefaultRoutingConfig(): RoutingSchema {
  return {
    version: 1,
    strategy: "balanced",
    rules: [],
    defaultModelId: null,
    enableCaching: true,
    cacheTtlMs: 300000,
    maxCacheSize: 1000,
  };
}

export function applyRoutingDefaults(config: Partial<RoutingSchema>): RoutingSchema {
  const defaults = getDefaultRoutingConfig();
  return {
    version: config.version ?? defaults.version,
    strategy: config.strategy ?? defaults.strategy,
    rules: (config.rules ?? defaults.rules).map((r) => ({
      ...r,
      priority: r.priority ?? 0,
      enabled: r.enabled ?? true,
      metadata: r.metadata ?? {},
    })),
    defaultModelId: config.defaultModelId ?? defaults.defaultModelId,
    enableCaching: config.enableCaching ?? defaults.enableCaching,
    cacheTtlMs: config.cacheTtlMs ?? defaults.cacheTtlMs,
    maxCacheSize: config.maxCacheSize ?? defaults.maxCacheSize,
  };
}
