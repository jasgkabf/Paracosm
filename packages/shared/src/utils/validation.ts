export function validateConfig<T extends Record<string, unknown>>(
  config: unknown,
  requiredKeys: string[],
): config is T {
  if (typeof config !== 'object' || config === null) {
    return false;
  }
  return requiredKeys.every((key) => key in config);
}

export function validateAPIKey(key: string): boolean {
  if (!isNonEmptyString(key)) {
    return false;
  }
  return key.length >= 8 && key.length <= 512;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && value > 0 && Number.isFinite(value);
}

export function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function isValidPort(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 65535;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
