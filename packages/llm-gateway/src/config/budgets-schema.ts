export const budgetsSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "BudgetsConfig",
  type: "object",
  required: ["dailyLimitUsd", "monthlyLimitUsd"],
  properties: {
    version: { type: "number", default: 1 },
    dailyLimitUsd: { type: "number", minimum: 0, default: 50 },
    monthlyLimitUsd: { type: "number", minimum: 0, default: 1000 },
    perRequestLimitUsd: { type: "number", minimum: 0, default: 5 },
    alertThresholdPercent: { type: "number", minimum: 0, maximum: 100, default: 80 },
    enableThrottling: { type: "boolean", default: true },
    throttleAtPercent: { type: "number", minimum: 0, maximum: 100, default: 90 },
  },
  additionalProperties: false,
} as const;

export interface BudgetsSchema {
  version: number;
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  perRequestLimitUsd: number;
  alertThresholdPercent: number;
  enableThrottling: boolean;
  throttleAtPercent: number;
}

export function validateBudgetsConfig(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (data === null || data === undefined) {
    return { valid: false, errors: ["Budgets config is null or undefined"] };
  }
  if (typeof data !== "object") {
    return { valid: false, errors: ["Budgets config must be an object"] };
  }
  const config = data as Record<string, unknown>;
  if (typeof config.dailyLimitUsd !== "number" || config.dailyLimitUsd < 0) {
    errors.push("dailyLimitUsd must be a non-negative number");
  }
  if (typeof config.monthlyLimitUsd !== "number" || config.monthlyLimitUsd < 0) {
    errors.push("monthlyLimitUsd must be a non-negative number");
  }
  if (config.dailyLimitUsd !== undefined && config.monthlyLimitUsd !== undefined) {
    if (config.dailyLimitUsd != null && config.monthlyLimitUsd != null && config.dailyLimitUsd > config.monthlyLimitUsd) {
      errors.push("dailyLimitUsd cannot exceed monthlyLimitUsd");
    }
  }
  if (config.perRequestLimitUsd !== undefined) {
    if (typeof config.perRequestLimitUsd !== "number" || config.perRequestLimitUsd < 0) {
      errors.push("perRequestLimitUsd must be a non-negative number");
    }
    if (config.dailyLimitUsd != null && config.perRequestLimitUsd != null && config.perRequestLimitUsd > config.dailyLimitUsd) {
      errors.push("perRequestLimitUsd cannot exceed dailyLimitUsd");
    }
  }
  if (config.alertThresholdPercent !== undefined) {
    if (typeof config.alertThresholdPercent !== "number" || config.alertThresholdPercent < 0 || config.alertThresholdPercent > 100) {
      errors.push("alertThresholdPercent must be 0-100");
    }
  }
  if (config.throttleAtPercent !== undefined) {
    if (typeof config.throttleAtPercent !== "number" || config.throttleAtPercent < 0 || config.throttleAtPercent > 100) {
      errors.push("throttleAtPercent must be 0-100");
    }
  }
  if (config.enableThrottling !== undefined && typeof config.enableThrottling !== "boolean") {
    errors.push("enableThrottling must be a boolean");
  }
  return { valid: errors.length === 0, errors };
}

export function getDefaultBudgetsConfig(): BudgetsSchema {
  return {
    version: 1,
    dailyLimitUsd: 50,
    monthlyLimitUsd: 1000,
    perRequestLimitUsd: 5,
    alertThresholdPercent: 80,
    enableThrottling: true,
    throttleAtPercent: 90,
  };
}

export function applyBudgetsDefaults(config: Partial<BudgetsSchema>): BudgetsSchema {
  const defaults = getDefaultBudgetsConfig();
  return {
    version: config.version ?? defaults.version,
    dailyLimitUsd: config.dailyLimitUsd ?? defaults.dailyLimitUsd,
    monthlyLimitUsd: config.monthlyLimitUsd ?? defaults.monthlyLimitUsd,
    perRequestLimitUsd: config.perRequestLimitUsd ?? defaults.perRequestLimitUsd,
    alertThresholdPercent: config.alertThresholdPercent ?? defaults.alertThresholdPercent,
    enableThrottling: config.enableThrottling ?? defaults.enableThrottling,
    throttleAtPercent: config.throttleAtPercent ?? defaults.throttleAtPercent,
  };
}
