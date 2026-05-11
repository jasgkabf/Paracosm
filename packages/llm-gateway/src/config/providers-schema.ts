import type { ProviderConfig } from '@paracosm/shared';
import { isNonEmptyString, isPositiveNumber } from '@paracosm/shared';

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

export class ProvidersSchema {
  static validate(providers: ProviderConfig[]): SchemaValidationResult {
    const errors: string[] = [];

    if (!Array.isArray(providers)) {
      return { valid: false, errors: ['Providers must be an array'] };
    }

    if (providers.length === 0) {
      errors.push('At least one provider must be configured');
    }

    const providerNames = new Set<string>();

    for (let i = 0; i < providers.length; i++) {
      const p = providers[i];
      const prefix = `Provider[${i}]`;

      if (!isNonEmptyString(p.provider)) {
        errors.push(`${prefix}: provider name is required`);
      } else {
        if (providerNames.has(p.provider)) {
          errors.push(`${prefix}: duplicate provider name '${p.provider}'`);
        }
        providerNames.add(p.provider);
      }

      if (!isNonEmptyString(p.apiKey) && p.provider !== 'local') {
        errors.push(`${prefix}: apiKey is required for non-local providers`);
      }

      if (p.baseUrl !== undefined && typeof p.baseUrl === 'string' && p.baseUrl.length > 0) {
        try {
          new URL(p.baseUrl);
        } catch {
          errors.push(`${prefix}: baseUrl is not a valid URL`);
        }
      }

      if (!Array.isArray(p.models) || p.models.length === 0) {
        errors.push(`${prefix}: at least one model must be specified`);
      }

      if (!isNonEmptyString(p.defaultModel)) {
        errors.push(`${prefix}: defaultModel is required`);
      } else if (Array.isArray(p.models) && !p.models.includes(p.defaultModel)) {
        errors.push(
          `${prefix}: defaultModel '${p.defaultModel}' not found in models list`,
        );
      }

      if (!isPositiveNumber(p.maxConcurrentRequests)) {
        errors.push(`${prefix}: maxConcurrentRequests must be a positive number`);
      }

      if (!isPositiveNumber(p.timeout)) {
        errors.push(`${prefix}: timeout must be a positive number`);
      }

      if (typeof p.retries !== 'number' || p.retries < 0 || !Number.isInteger(p.retries)) {
        errors.push(`${prefix}: retries must be a non-negative integer`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  static getRequiredFields(): string[] {
    return ['provider', 'apiKey', 'models', 'defaultModel', 'maxConcurrentRequests', 'timeout', 'retries'];
  }

  static getDefaults(): Partial<ProviderConfig> {
    return {
      maxConcurrentRequests: 10,
      timeout: 30000,
      retries: 3,
      metadata: {},
    };
  }
}

export function validateProvidersConfig(providers: ProviderConfig[]): SchemaValidationResult {
  return ProvidersSchema.validate(providers);
}
