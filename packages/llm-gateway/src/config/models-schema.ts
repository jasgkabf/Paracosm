export const modelsSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "ModelsConfig",
  type: "object",
  required: ["models"],
  properties: {
    version: { type: "number", default: 1 },
    models: {
      type: "array",
      items: {
        type: "object",
        required: ["modelId", "providerId"],
        properties: {
          modelId: { type: "string", minLength: 1 },
          providerId: { type: "string", minLength: 1 },
          temperature: { type: "number", minimum: 0, maximum: 2, default: 0.7 },
          maxTokens: { type: "number", minimum: 1, maximum: 128000, default: 4096 },
          topP: { type: "number", minimum: 0, maximum: 1, default: 1 },
          frequencyPenalty: { type: "number", minimum: -2, maximum: 2, default: 0 },
          presencePenalty: { type: "number", minimum: -2, maximum: 2, default: 0 },
          stop: { type: "array", items: { type: "string" }, default: [] },
          responseFormat: { type: ["string", "null"], enum: ["text", "json", null], default: null },
          seed: { type: ["number", "null"], default: null },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const;

export interface ModelsSchema {
  version: number;
  models: {
    modelId: string;
    providerId: string;
    temperature: number;
    maxTokens: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
    stop: string[];
    responseFormat: "text" | "json" | null;
    seed: number | null;
  }[];
}

export function validateModelsConfig(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (data === null || data === undefined) {
    return { valid: false, errors: ["Models config is null or undefined"] };
  }
  if (typeof data !== "object") {
    return { valid: false, errors: ["Models config must be an object"] };
  }
  const config = data as Record<string, unknown>;
  if (!Array.isArray(config.models)) {
    return { valid: false, errors: ["models must be an array"] };
  }
  const modelIds = new Set<string>();
  for (let i = 0; i < config.models.length; i++) {
    const model = config.models[i] as Record<string, unknown>;
    if (!model) {
      errors.push(`Model at index ${i} is null`);
      continue;
    }
    if (typeof model.modelId !== "string" || model.modelId.length === 0) {
      errors.push(`Model at index ${i} missing modelId`);
    }
    if (modelIds.has(model.modelId as string)) {
      errors.push(`Duplicate modelId: ${model.modelId}`);
    }
    modelIds.add(model.modelId as string);
    if (typeof model.providerId !== "string" || model.providerId.length === 0) {
      errors.push(`Model at index ${i} missing providerId`);
    }
    if (model.temperature !== undefined && (typeof model.temperature !== "number" || model.temperature < 0 || model.temperature > 2)) {
      errors.push(`Model at index ${i} temperature must be 0-2`);
    }
    if (model.maxTokens !== undefined && (typeof model.maxTokens !== "number" || model.maxTokens < 1)) {
      errors.push(`Model at index ${i} maxTokens must be >= 1`);
    }
    if (model.topP !== undefined && (typeof model.topP !== "number" || model.topP < 0 || model.topP > 1)) {
      errors.push(`Model at index ${i} topP must be 0-1`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function getDefaultModelsConfig(): ModelsSchema {
  return {
    version: 1,
    models: [],
  };
}

export function applyModelsDefaults(config: Partial<ModelsSchema>): ModelsSchema {
  const defaults = getDefaultModelsConfig();
  return {
    version: config.version ?? defaults.version,
    models: (config.models ?? defaults.models).map((m) => ({
      ...m,
      temperature: m.temperature ?? 0.7,
      maxTokens: m.maxTokens ?? 4096,
      topP: m.topP ?? 1,
      frequencyPenalty: m.frequencyPenalty ?? 0,
      presencePenalty: m.presencePenalty ?? 0,
      stop: m.stop ?? [],
      responseFormat: m.responseFormat ?? (null as "text" | "json" | null),
      seed: m.seed ?? null,
    })),
  };
}
