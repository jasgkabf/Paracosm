import type { ProviderConfig } from '@paracosm/shared';
import { isNonEmptyString } from '@paracosm/shared';

export interface ModelsValidationResult {
  valid: boolean;
  errors: string[];
}

export class ModelsSchema {
  private static readonly KNOWN_MODEL_PATTERNS: Record<string, RegExp[]> = {
    openai: [/^gpt-/, /^o1-/, /^dall-e/],
    anthropic: [/^claude-/],
    google: [/^gemini-/, /^palm-/],
    mistral: [/^mistral-/, /^codestral/],
    cohere: [/^command-/],
    deepseek: [/^deepseek-/],
    moonshot: [/^moonshot-/],
  };

  static validate(
    providers: ProviderConfig[],
    defaultModel: string,
  ): ModelsValidationResult {
    const errors: string[] = [];

    if (!isNonEmptyString(defaultModel)) {
      errors.push('A default model must be specified');
    }

    const allModels = new Set<string>();
    let defaultModelFound = false;

    for (const provider of providers) {
      if (!Array.isArray(provider.models)) {
        errors.push(`Provider '${provider.provider}' has no models array`);
        continue;
      }

      for (const model of provider.models) {
        if (!isNonEmptyString(model)) {
          errors.push(
            `Provider '${provider.provider}' has an empty model name`,
          );
          continue;
        }

        if (allModels.has(model)) {
          errors.push(`Model '${model}' is defined in multiple providers`);
        }
        allModels.add(model);

        if (model === defaultModel) {
          defaultModelFound = true;
        }
      }

      if (!provider.models.includes(provider.defaultModel)) {
        errors.push(
          `Provider '${provider.provider}' defaultModel '${provider.defaultModel}' not in its models list`,
        );
      }

      const unknownModels = provider.models.filter(
        (m) => !this.isKnownModel(provider.provider, m),
      );
      if (unknownModels.length > 0 && provider.provider !== 'local' && provider.provider !== 'custom') {
        errors.push(
          `Provider '${provider.provider}' has unknown models: ${unknownModels.join(', ')}`,
        );
      }
    }

    if (!defaultModelFound && isNonEmptyString(defaultModel)) {
      errors.push(
        `Default model '${defaultModel}' not found in any provider's model list`,
      );
    }

    return { valid: errors.length === 0, errors };
  }

  static isKnownModel(provider: string, model: string): boolean {
    const patterns = this.KNOWN_MODEL_PATTERNS[provider];
    if (!patterns) return true;
    return patterns.some((pattern) => pattern.test(model));
  }

  static getModelProvider(providers: ProviderConfig[], model: string): string | null {
    for (const provider of providers) {
      if (provider.models.includes(model)) {
        return provider.provider;
      }
    }
    return null;
  }

  static getAllModels(providers: ProviderConfig[]): string[] {
    const models = new Set<string>();
    for (const provider of providers) {
      for (const model of provider.models) {
        models.add(model);
      }
    }
    return Array.from(models).sort();
  }

  static getModelsByProvider(providers: ProviderConfig[]): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const provider of providers) {
      result[provider.provider] = [...provider.models];
    }
    return result;
  }
}

export function validateModelsConfig(
  providers: ProviderConfig[],
  defaultModel: string,
): ModelsValidationResult {
  return ModelsSchema.validate(providers, defaultModel);
}
