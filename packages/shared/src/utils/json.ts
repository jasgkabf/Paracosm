import { Result, ok, err } from "../types/common.js";

export function safeParse<T>(str: string): Result<T, string> {
  try {
    const parsed = JSON.parse(str);
    return ok(parsed as T);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(`JSON parse error: ${message}`);
  }
}

export function safeStringify(obj: unknown, indent?: number): Result<string, string> {
  try {
    const stringified = JSON.stringify(obj, null, indent);
    if (stringified === undefined) {
      return err("JSON stringify error: value cannot be serialized");
    }
    return ok(stringified);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(`JSON stringify error: ${message}`);
  }
}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj)) as T;
}

export function merge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  return { ...target, ...source };
}

export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target } as Record<string, any>;
  for (const key of Object.keys(source)) {
    const sourceVal = (source as Record<string, any>)[key];
    const targetVal = result[key];
    if (
      sourceVal !== null &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, any>,
        sourceVal as Record<string, any>
      );
    } else {
      result[key] = sourceVal;
    }
  }
  return result as T;
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const keySet = new Set<string>(keys as string[]);
  const result = {} as Record<string, unknown>;
  for (const key of Object.keys(obj as object)) {
    if (!keySet.has(key)) {
      result[key] = (obj as Record<string, unknown>)[key];
    }
  }
  return result as Omit<T, K>;
}
