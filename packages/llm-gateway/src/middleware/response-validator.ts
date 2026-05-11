import { Result, ok, err } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";

const logger = new Logger("ResponseValidator");

export interface ValidationRule {
  field: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  custom?: (value: unknown) => boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const CONTENT_POLICY_PATTERNS = [
  /violence/i,
  /harmful/i,
  /illegal/i,
  /hate\s+speech/i,
];

export class ResponseValidator {
  private schemaRules: Map<string, ValidationRule[]> = new Map();
  private contentPolicyEnabled: boolean = true;

  validate(response: Record<string, unknown>, schemaName?: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (schemaName) {
      const rules = this.schemaRules.get(schemaName);
      if (rules) {
        const schemaResult = this.validateSchema(response, rules);
        errors.push(...schemaResult.errors);
        warnings.push(...schemaResult.warnings);
      }
    }

    if (!response || typeof response !== "object") {
      errors.push("Response must be an object");
      return { valid: false, errors, warnings };
    }

    if (response.content !== undefined && response.content !== null) {
      if (typeof response.content !== "string") {
        errors.push("Response content must be a string or null");
      }
    }

    if (response.usage !== undefined) {
      const usageResult = this.validateUsage(response.usage as Record<string, unknown>);
      errors.push(...usageResult.errors);
      warnings.push(...usageResult.warnings);
    }

    const formatResult = this.checkFormat(response);
    warnings.push(...formatResult.warnings);

    if (this.contentPolicyEnabled) {
      const policyResult = this.checkContentPolicy(response);
      warnings.push(...policyResult.warnings);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  registerSchema(name: string, rules: ValidationRule[]): void {
    this.schemaRules.set(name, rules);
  }

  checkContentPolicy(response: Record<string, unknown>): ValidationResult {
    const warnings: string[] = [];
    const content = response.content as string | undefined;

    if (content) {
      for (const pattern of CONTENT_POLICY_PATTERNS) {
        if (pattern.test(content)) {
          warnings.push(`Content may violate policy: matched pattern ${pattern.source}`);
        }
      }
    }

    return { valid: true, errors: [], warnings };
  }

  checkFormat(response: Record<string, unknown>): ValidationResult {
    const warnings: string[] = [];

    if (response.finishReason === "content_filter") {
      warnings.push("Response was filtered due to content policy");
    }

    if (response.finishReason === "length") {
      warnings.push("Response was truncated due to max token limit");
    }

    if (response.content && typeof response.content === "string") {
      if (response.content.length === 0) {
        warnings.push("Response content is empty");
      }
    }

    return { valid: true, errors: [], warnings };
  }

  private validateSchema(data: Record<string, unknown>, rules: ValidationRule[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const rule of rules) {
      const value = data[rule.field];

      if (value === undefined || value === null) {
        if (rule.required) {
          errors.push(`Required field "${rule.field}" is missing`);
        }
        continue;
      }

      if (rule.type === "string" && typeof value !== "string") {
        errors.push(`Field "${rule.field}" must be a string, got ${typeof value}`);
        continue;
      }
      if (rule.type === "number" && typeof value !== "number") {
        errors.push(`Field "${rule.field}" must be a number, got ${typeof value}`);
        continue;
      }
      if (rule.type === "boolean" && typeof value !== "boolean") {
        errors.push(`Field "${rule.field}" must be a boolean, got ${typeof value}`);
        continue;
      }
      if (rule.type === "object" && (typeof value !== "object" || Array.isArray(value))) {
        errors.push(`Field "${rule.field}" must be an object`);
        continue;
      }
      if (rule.type === "array" && !Array.isArray(value)) {
        errors.push(`Field "${rule.field}" must be an array`);
        continue;
      }

      if (rule.type === "string" && typeof value === "string") {
        if (rule.minLength !== undefined && value.length < rule.minLength) {
          errors.push(`Field "${rule.field}" must be at least ${rule.minLength} characters`);
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
          warnings.push(`Field "${rule.field}" exceeds max length of ${rule.maxLength}`);
        }
        if (rule.pattern && !new RegExp(rule.pattern).test(value)) {
          errors.push(`Field "${rule.field}" does not match pattern ${rule.pattern}`);
        }
      }

      if (rule.type === "number" && typeof value === "number") {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`Field "${rule.field}" must be >= ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`Field "${rule.field}" must be <= ${rule.max}`);
        }
      }

      if (rule.custom && !rule.custom(value)) {
        errors.push(`Field "${rule.field}" failed custom validation`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private validateUsage(usage: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof usage.promptTokens === "number" && usage.promptTokens < 0) {
      errors.push("promptTokens must be non-negative");
    }
    if (typeof usage.completionTokens === "number" && usage.completionTokens < 0) {
      errors.push("completionTokens must be non-negative");
    }
    if (typeof usage.totalTokens === "number" && usage.totalTokens < 0) {
      errors.push("totalTokens must be non-negative");
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}
