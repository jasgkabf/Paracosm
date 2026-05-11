import { Result, ok, err } from "../types/common.js";
import type { RoutingRule, BudgetConfig } from "../types/llm.js";

export function validateConfig<T>(
  config: unknown,
  schema: Record<string, unknown>
): Result<T, string> {
  if (config === null || config === undefined) {
    return err("Config is null or undefined");
  }
  if (typeof config !== "object") {
    return err("Config must be an object");
  }
  const configObj = config as Record<string, unknown>;
  for (const key of Object.keys(schema)) {
    const rule = schema[key];
    if (!(key in configObj)) {
      if (rule === "required") {
        return err(`Missing required field: ${key}`);
      }
      continue;
    }
    const value = configObj[key];
    if (typeof rule === "string" && rule !== "required") {
      if (typeof value !== rule) {
        return err(`Field "${key}" must be of type ${rule}, got ${typeof value}`);
      }
    }
    if (typeof rule === "object" && rule !== null && "type" in rule) {
      const typeRule = rule as { type: string; values?: unknown[] };
      if (typeof value !== typeRule.type) {
        return err(`Field "${key}" must be of type ${typeRule.type}, got ${typeof value}`);
      }
      if (typeRule.values && !typeRule.values.includes(value)) {
        return err(`Field "${key}" must be one of: ${typeRule.values.join(", ")}`);
      }
    }
  }
  return ok(configObj as T);
}

const API_KEY_PATTERNS: Record<string, RegExp> = {
  openai: /^sk-[A-Za-z0-9_-]{20,}$/,
  anthropic: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
  google: /^AIza[A-Za-z0-9_-]{30,}$/,
  mistral: /^[A-Za-z0-9]{20,}$/,
  cohere: /^[A-Za-z0-9]{20,}$/,
};

export function validateAPIKey(key: string, provider: string): boolean {
  if (!isNonEmptyString(key)) {
    return false;
  }
  const pattern = API_KEY_PATTERNS[provider.toLowerCase()];
  if (pattern) {
    return pattern.test(key);
  }
  return key.length >= 16;
}

const KNOWN_MODELS = [
  "gpt-4", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo",
  "claude-3-opus", "claude-3-sonnet", "claude-3-haiku",
  "claude-3.5-sonnet", "claude-3.5-haiku",
  "gemini-pro", "gemini-ultra", "gemini-1.5-pro",
  "mistral-large", "mistral-medium", "mistral-small", "mixtral",
  "command-r", "command-r-plus",
];

export function validateModel(model: string): boolean {
  if (!isNonEmptyString(model)) {
    return false;
  }
  for (const known of KNOWN_MODELS) {
    if (model.startsWith(known) || model === known) {
      return true;
    }
  }
  if (/^[a-zA-Z][a-zA-Z0-9._-]{2,}$/.test(model)) {
    return true;
  }
  return false;
}

export function validateRouting(rules: RoutingRule[]): boolean {
  if (!Array.isArray(rules)) {
    return false;
  }
  const seenIds = new Set<string>();
  for (const rule of rules) {
    if (!isNonEmptyString(rule.id)) {
      return false;
    }
    if (seenIds.has(rule.id)) {
      return false;
    }
    seenIds.add(rule.id);
    if (!isNonEmptyString(rule.name)) {
      return false;
    }
    if (!isNonEmptyString(rule.condition)) {
      return false;
    }
    if (typeof rule.priority !== "number" || rule.priority < 0) {
      return false;
    }
    if (typeof rule.enabled !== "boolean") {
      return false;
    }
  }
  return true;
}

export function validateBudget(budget: BudgetConfig): boolean {
  if (budget === null || typeof budget !== "object") {
    return false;
  }
  if (!isPositiveNumber(budget.dailyLimitUsd)) {
    return false;
  }
  if (!isPositiveNumber(budget.monthlyLimitUsd)) {
    return false;
  }
  if (!isPositiveNumber(budget.perRequestLimitUsd)) {
    return false;
  }
  if (budget.dailyLimitUsd > budget.monthlyLimitUsd) {
    return false;
  }
  if (budget.perRequestLimitUsd > budget.dailyLimitUsd) {
    return false;
  }
  if (typeof budget.alertThresholdPercent !== "number" || budget.alertThresholdPercent < 0 || budget.alertThresholdPercent > 100) {
    return false;
  }
  if (typeof budget.enableThrottling !== "boolean") {
    return false;
  }
  if (typeof budget.throttleAtPercent !== "number" || budget.throttleAtPercent < 0 || budget.throttleAtPercent > 100) {
    return false;
  }
  return true;
}

export function isNonEmptyString(val: unknown): val is string {
  return typeof val === "string" && val.length > 0;
}

export function isPositiveNumber(val: unknown): val is number {
  return typeof val === "number" && Number.isFinite(val) && val > 0;
}

export function isValidUrl(val: string): boolean {
  if (!isNonEmptyString(val)) {
    return false;
  }
  try {
    const url = new URL(val);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function isValidEmail(val: string): boolean {
  if (!isNonEmptyString(val)) {
    return false;
  }
  return EMAIL_REGEX.test(val);
}

export function isValidPort(val: number): boolean {
  return typeof val === "number" && Number.isInteger(val) && val >= 1 && val <= 65535;
}

export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new Error(`min (${min}) must be less than or equal to max (${max})`);
  }
  return Math.min(Math.max(value, min), max);
}
