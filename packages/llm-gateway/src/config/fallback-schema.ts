import type { FallbackConfig } from '@paracosm/shared';
import { isPositiveNumber, isNonEmptyString } from '@paracosm/shared';

export interface FallbackValidationResult {
  valid: boolean;
  errors: string[];
}

export class FallbackSchema {
  static validate(config: FallbackConfig): FallbackValidationResult {
    const errors: string[] = [];

    if (typeof config.enabled !== 'boolean') {
      errors.push('enabled must be a boolean');
    }

    if (config.maxRetries !== undefined) {
      if (typeof config.maxRetries !== 'number' || config.maxRetries < 0 || !Number.isInteger(config.maxRetries)) {
        errors.push('maxRetries must be a non-negative integer');
      }
    }

    if (config.retryDelay !== undefined) {
      if (!isPositiveNumber(config.retryDelay)) {
        errors.push('retryDelay must be a positive number');
      }
    }

    if (config.backoffMultiplier !== undefined) {
      if (typeof config.backoffMultiplier !== 'number' || config.backoffMultiplier < 1) {
        errors.push('backoffMultiplier must be a number >= 1');
      }
    }

    if (config.fallbackProviders !== undefined) {
      if (!Array.isArray(config.fallbackProviders)) {
        errors.push('fallbackProviders must be an array');
      } else {
        for (let i = 0; i < config.fallbackProviders.length; i++) {
          if (!isNonEmptyString(config.fallbackProviders[i])) {
            errors.push(`fallbackProviders[${i}] must be a non-empty string`);
          }
        }

        const uniqueProviders = new Set(config.fallbackProviders);
        if (uniqueProviders.size !== config.fallbackProviders.length) {
          errors.push('fallbackProviders contains duplicates');
        }
      }
    }

    if (config.fallbackModels !== undefined) {
      if (!Array.isArray(config.fallbackModels)) {
        errors.push('fallbackModels must be an array');
      } else {
        for (let i = 0; i < config.fallbackModels.length; i++) {
          if (!isNonEmptyString(config.fallbackModels[i])) {
            errors.push(`fallbackModels[${i}] must be a non-empty string`);
          }
        }
      }
    }

    if (config.enabled) {
      if (config.maxRetries === 0) {
        errors.push('Fallback is enabled but maxRetries is 0');
      }
      if (
        (!config.fallbackProviders || config.fallbackProviders.length === 0) &&
        (!config.fallbackModels || config.fallbackModels.length === 0)
      ) {
        errors.push(
          'Fallback is enabled but no fallback providers or models are configured',
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  static getDefaults(): FallbackConfig {
    return {
      enabled: true,
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
      fallbackProviders: [],
      fallbackModels: [],
    };
  }

  static buildFallbackChain(
    primaryProvider: string,
    primaryModel: string,
    config: FallbackConfig,
    availableProviders: string[],
  ): Array<{ provider: string; model: string }> {
    const chain: Array<{ provider: string; model: string }> = [
      { provider: primaryProvider, model: primaryModel },
    ];

    if (!config.enabled) {
      return chain;
    }

    for (const provider of config.fallbackProviders) {
      if (provider !== primaryProvider && availableProviders.includes(provider)) {
        chain.push({ provider, model: primaryModel });
      }
    }

    for (const model of config.fallbackModels) {
      if (model !== primaryModel) {
        chain.push({ provider: primaryProvider, model });
      }
    }

    const seen = new Set<string>();
    return chain.filter((item) => {
      const key = `${item.provider}:${item.model}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export function validateFallbackConfig(config: FallbackConfig): FallbackValidationResult {
  return FallbackSchema.validate(config);
}
