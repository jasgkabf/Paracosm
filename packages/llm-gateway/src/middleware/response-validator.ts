import { createLogger } from '@paracosm/shared';
import type { Middleware, MiddlewareContext } from './middleware-pipeline.js';

const logger = createLogger('ResponseValidator');

export interface ValidationRule {
  name: string;
  validate: (response: unknown) => ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

export interface SchemaDefinition {
  type: string;
  required?: boolean;
  properties?: Record<string, SchemaDefinition>;
  items?: SchemaDefinition;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  enum?: unknown[];
  pattern?: string;
}

export class ResponseValidator implements Middleware {
  name = 'response-validator';
  order = 25;

  private customRules: ValidationRule[] = [];
  private responseSchema: SchemaDefinition;
  private strictMode: boolean = false;
  private validationHistory: Array<{
    requestId: string;
    valid: boolean;
    errorCount: number;
    warningCount: number;
    timestamp: number;
  }> = [];
  private maxHistorySize: number = 500;

  constructor(config?: { strict?: boolean; customSchema?: SchemaDefinition }) {
    this.strictMode = config?.strict ?? false;
    this.responseSchema = config?.customSchema ?? this.getDefaultSchema();
  }

  async afterResponse(context: MiddlewareContext): Promise<MiddlewareContext> {
    if (!context.response) return context;

    const result = this.validate(context.response);

    this.validationHistory.push({
      requestId: context.response.requestId,
      valid: result.valid,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      timestamp: Date.now(),
    });
    if (this.validationHistory.length > this.maxHistorySize) {
      this.validationHistory = this.validationHistory.slice(-this.maxHistorySize);
    }

    if (!result.valid) {
      logger.warn('Response validation failed', {
        requestId: context.response.requestId,
        errors: result.errors.map((e) => e.message),
      });

      if (this.strictMode) {
        context.aborted = true;
        context.abortReason = 'Response validation failed in strict mode';
      }

      context.metadata.validationErrors = result.errors;
    }

    if (result.warnings.length > 0) {
      context.metadata.validationWarnings = result.warnings;
    }

    context.metadata.validationResult = result.valid;
    return context;
  }

  validate(response: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const schemaResult = this.validateSchema(response, this.responseSchema, '');
    errors.push(...schemaResult.errors);
    warnings.push(...schemaResult.warnings);

    if (typeof response === 'object' && response !== null) {
      const obj = response as Record<string, unknown>;
      const formatResult = this.validateFormat(obj);
      errors.push(...formatResult.errors);
      warnings.push(...formatResult.warnings);
    }

    for (const rule of this.customRules) {
      try {
        const ruleResult = rule.validate(response);
        errors.push(...ruleResult.errors);
        warnings.push(...ruleResult.warnings);
      } catch (error) {
        warnings.push({
          field: `rule:${rule.name}`,
          message: `Rule validation error: ${(error as Error).message}`,
          code: 'RULE_ERROR',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  addRule(rule: ValidationRule): void {
    this.customRules.push(rule);
  }

  removeRule(name: string): boolean {
    const index = this.customRules.findIndex((r) => r.name === name);
    if (index === -1) return false;
    this.customRules.splice(index, 1);
    return true;
  }

  setSchema(schema: SchemaDefinition): void {
    this.responseSchema = schema;
  }

  getSchema(): SchemaDefinition {
    return { ...this.responseSchema };
  }

  getValidationHistory(): typeof this.validationHistory {
    return [...this.validationHistory];
  }

  getValidationStats(): {
    total: number;
    valid: number;
    invalid: number;
    validationRate: number;
  } {
    const total = this.validationHistory.length;
    const valid = this.validationHistory.filter((h) => h.valid).length;
    return {
      total,
      valid,
      invalid: total - valid,
      validationRate: total > 0 ? valid / total : 0,
    };
  }

  private validateSchema(
    value: unknown,
    schema: SchemaDefinition,
    path: string,
  ): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (value === null || value === undefined) {
      if (schema.required) {
        errors.push({
          field: path || 'root',
          message: `Field is required`,
          code: 'REQUIRED',
          value,
        });
      }
      return { errors, warnings };
    }

    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (schema.type && actualType !== schema.type) {
      errors.push({
        field: path || 'root',
        message: `Expected type ${schema.type}, got ${actualType}`,
        code: 'TYPE_MISMATCH',
        value,
      });
      return { errors, warnings };
    }

    if (schema.type === 'string' && typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push({
          field: path,
          message: `String length ${value.length} is less than minimum ${schema.minLength}`,
          code: 'MIN_LENGTH',
          value,
        });
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push({
          field: path,
          message: `String length ${value.length} exceeds maximum ${schema.maxLength}`,
          code: 'MAX_LENGTH',
          value,
        });
      }
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        errors.push({
          field: path,
          message: `String does not match pattern ${schema.pattern}`,
          code: 'PATTERN_MISMATCH',
          value,
        });
      }
    }

    if (schema.type === 'number' && typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push({
          field: path,
          message: `Value ${value} is less than minimum ${schema.minimum}`,
          code: 'MINIMUM',
          value,
        });
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push({
          field: path,
          message: `Value ${value} exceeds maximum ${schema.maximum}`,
          code: 'MAXIMUM',
          value,
        });
      }
    }

    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        field: path,
        message: `Value not in enum: ${schema.enum.join(', ')}`,
        code: 'ENUM_MISMATCH',
        value,
      });
    }

    if (schema.type === 'object' && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          const propPath = path ? `${path}.${key}` : key;
          const propResult = this.validateSchema(obj[key], propSchema, propPath);
          errors.push(...propResult.errors);
          warnings.push(...propResult.warnings);
        }
      }
    }

    if (schema.type === 'array' && Array.isArray(value)) {
      if (schema.items) {
        for (let i = 0; i < value.length; i++) {
          const itemPath = `${path}[${i}]`;
          const itemResult = this.validateSchema(value[i], schema.items, itemPath);
          errors.push(...itemResult.errors);
          warnings.push(...itemResult.warnings);
        }
      }
    }

    return { errors, warnings };
  }

  private validateFormat(obj: Record<string, unknown>): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (typeof obj.content === 'string' && obj.content.length === 0) {
      warnings.push({
        field: 'content',
        message: 'Response content is empty',
        code: 'EMPTY_CONTENT',
      });
    }

    if (obj.usage && typeof obj.usage === 'object') {
      const usage = obj.usage as Record<string, unknown>;
      if (typeof usage.totalTokens === 'number' && usage.totalTokens < 0) {
        errors.push({
          field: 'usage.totalTokens',
          message: 'Total tokens cannot be negative',
          code: 'NEGATIVE_TOKENS',
          value: usage.totalTokens,
        });
      }
      if (
        typeof usage.promptTokens === 'number' &&
        typeof usage.completionTokens === 'number' &&
        typeof usage.totalTokens === 'number' &&
        usage.promptTokens + usage.completionTokens !== usage.totalTokens
      ) {
        warnings.push({
          field: 'usage',
          message: 'Token usage sum mismatch',
          code: 'TOKEN_SUM_MISMATCH',
        });
      }
    }

    if (obj.latencyMs && typeof obj.latencyMs === 'number' && obj.latencyMs < 0) {
      errors.push({
        field: 'latencyMs',
        message: 'Latency cannot be negative',
        code: 'NEGATIVE_LATENCY',
        value: obj.latencyMs,
      });
    }

    return { errors, warnings };
  }

  private getDefaultSchema(): SchemaDefinition {
    return {
      type: 'object',
      required: true,
      properties: {
        id: { type: 'string', required: true },
        requestId: { type: 'string', required: true },
        content: { type: 'string', required: true },
        model: { type: 'string', required: true },
        provider: { type: 'string', required: true },
        finishReason: { type: 'string', required: true },
        usage: {
          type: 'object',
          required: true,
          properties: {
            promptTokens: { type: 'number', required: true, minimum: 0 },
            completionTokens: { type: 'number', required: true, minimum: 0 },
            totalTokens: { type: 'number', required: true, minimum: 0 },
          },
        },
        latencyMs: { type: 'number', required: true, minimum: 0 },
      },
    };
  }
}
