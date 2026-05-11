import type { CustomProviderConfig } from '@paracosm/shared';
import { isNonEmptyString, isValidUrl } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('CustomProviderValidator');

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class CustomProviderValidator {
  validate(config: CustomProviderConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!isNonEmptyString(config.id)) {
      errors.push('Provider id is required');
    }

    if (!isNonEmptyString(config.name)) {
      errors.push('Provider name is required');
    }

    if (!isNonEmptyString(config.baseUrl)) {
      errors.push('Base URL is required');
    } else if (!isValidUrl(config.baseUrl)) {
      errors.push('Base URL is not a valid URL');
    }

    if (!config.supportedModels || !Array.isArray(config.supportedModels) || config.supportedModels.length === 0) {
      errors.push('At least one supported model is required');
    } else {
      for (let i = 0; i < config.supportedModels.length; i++) {
        if (!isNonEmptyString(config.supportedModels[i])) {
          errors.push(`supportedModels[${i}] must be a non-empty string`);
        }
      }
    }

    if (config.apiKey !== undefined && !isNonEmptyString(config.apiKey)) {
      warnings.push('API key is set but empty');
    }

    const requestMappingErrors = this.validateRequestMapping(config.requestMapping);
    errors.push(...requestMappingErrors);

    const responseMappingErrors = this.validateResponseMapping(config.responseMapping);
    errors.push(...responseMappingErrors);

    if (config.headers) {
      if (typeof config.headers !== 'object' || Array.isArray(config.headers)) {
        errors.push('Headers must be an object');
      } else {
        for (const [key, value] of Object.entries(config.headers)) {
          if (typeof value !== 'string') {
            errors.push(`Header '${key}' value must be a string`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  validateRequestMapping(mapping: CustomProviderConfig['requestMapping']): string[] {
    const errors: string[] = [];

    if (!mapping) {
      errors.push('Request mapping is required');
      return errors;
    }

    if (!isNonEmptyString(mapping.promptField)) {
      errors.push('requestMapping.promptField is required');
    }

    if (!isNonEmptyString(mapping.modelField)) {
      errors.push('requestMapping.modelField is required');
    }

    if (mapping.extraFields && typeof mapping.extraFields !== 'object') {
      errors.push('requestMapping.extraFields must be an object');
    }

    return errors;
  }

  validateResponseMapping(mapping: CustomProviderConfig['responseMapping']): string[] {
    const errors: string[] = [];

    if (!mapping) {
      errors.push('Response mapping is required');
      return errors;
    }

    if (!isNonEmptyString(mapping.contentField)) {
      errors.push('responseMapping.contentField is required');
    }

    if (!isNonEmptyString(mapping.errorField)) {
      errors.push('responseMapping.errorField is recommended for error handling');
    }

    return errors;
  }

  async testConnection(config: CustomProviderConfig): Promise<{
    connected: boolean;
    latencyMs: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const url = `${config.baseUrl.replace(/\/$/, '')}/models`;
      const headers: Record<string, string> = {
        ...config.headers,
      };

      if (config.apiKey) {
        if (!headers['Authorization']) {
          headers['Authorization'] = `Bearer ${config.apiKey}`;
        }
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000),
      });

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        return { connected: true, latencyMs };
      }

      return {
        connected: false,
        latencyMs,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error) {
      return {
        connected: false,
        latencyMs: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }
}
