import type { FastifyInstance, FastifyRequest, FastifyReply, HookHandlerDoneFunction } from "fastify";
import { createLogger } from "@paracosm/shared";

const logger = createLogger("api:middleware:request-validator");

interface ValidationRule {
  type: "string" | "number" | "boolean" | "object" | "array";
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  pattern?: RegExp;
  enum?: string[];
  properties?: Record<string, ValidationRule>;
  items?: ValidationRule;
}

interface ValidationError {
  field: string;
  message: string;
  value: unknown;
}

function validateField(value: unknown, rule: ValidationRule, fieldPath: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (value === undefined || value === null) {
    if (rule.required) {
      errors.push({ field: fieldPath, message: "Field is required", value });
    }
    return errors;
  }

  if (rule.type === "string") {
    if (typeof value !== "string") {
      errors.push({ field: fieldPath, message: `Expected string, got ${typeof value}`, value });
      return errors;
    }
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      errors.push({ field: fieldPath, message: `Minimum length is ${rule.minLength}`, value });
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      errors.push({ field: fieldPath, message: `Maximum length is ${rule.maxLength}`, value });
    }
    if (rule.pattern && !rule.pattern.test(value)) {
      errors.push({ field: fieldPath, message: `Value does not match pattern ${rule.pattern}`, value });
    }
    if (rule.enum && !rule.enum.includes(value)) {
      errors.push({ field: fieldPath, message: `Value must be one of: ${rule.enum.join(", ")}`, value });
    }
  }

  if (rule.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors.push({ field: fieldPath, message: `Expected number, got ${typeof value}`, value });
      return errors;
    }
    if (rule.minValue !== undefined && value < rule.minValue) {
      errors.push({ field: fieldPath, message: `Minimum value is ${rule.minValue}`, value });
    }
    if (rule.maxValue !== undefined && value > rule.maxValue) {
      errors.push({ field: fieldPath, message: `Maximum value is ${rule.maxValue}`, value });
    }
  }

  if (rule.type === "boolean") {
    if (typeof value !== "boolean") {
      errors.push({ field: fieldPath, message: `Expected boolean, got ${typeof value}`, value });
    }
  }

  if (rule.type === "object") {
    if (typeof value !== "object" || Array.isArray(value) || value === null) {
      errors.push({ field: fieldPath, message: `Expected object, got ${Array.isArray(value) ? "array" : typeof value}`, value });
      return errors;
    }
    if (rule.properties) {
      const obj = value as Record<string, unknown>;
      for (const [key, subRule] of Object.entries(rule.properties)) {
        const subErrors = validateField(obj[key], subRule, `${fieldPath}.${key}`);
        errors.push(...subErrors);
      }
    }
  }

  if (rule.type === "array") {
    if (!Array.isArray(value)) {
      errors.push({ field: fieldPath, message: `Expected array, got ${typeof value}`, value });
      return errors;
    }
    if (rule.items) {
      for (let i = 0; i < value.length; i++) {
        const itemErrors = validateField(value[i], rule.items, `${fieldPath}[${i}]`);
        errors.push(...itemErrors);
      }
    }
  }

  return errors;
}

function sanitizeString(value: string): string {
  let sanitized = value;
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  sanitized = sanitized.replace(/<[^>]+>/g, "");
  sanitized = sanitized.trim();
  return sanitized;
}

function sanitizeObject(obj: unknown): unknown {
  if (typeof obj === "string") {
    return sanitizeString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeObject(value);
    }
    return result;
  }
  return obj;
}

function coerceType(value: unknown, targetType: string): unknown {
  if (value === undefined || value === null) return value;

  switch (targetType) {
    case "number": {
      if (typeof value === "string") {
        const num = Number(value);
        if (Number.isFinite(num)) return num;
      }
      break;
    }
    case "boolean": {
      if (typeof value === "string") {
        if (value.toLowerCase() === "true") return true;
        if (value.toLowerCase() === "false") return false;
      }
      if (typeof value === "number") {
        return value !== 0;
      }
      break;
    }
    case "string": {
      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
      break;
    }
  }

  return value;
}

function transformBody(body: Record<string, unknown>, rules: Record<string, ValidationRule>): Record<string, unknown> {
  const transformed: Record<string, unknown> = { ...body };

  for (const [key, rule] of Object.entries(rules)) {
    if (key in transformed) {
      transformed[key] = coerceType(transformed[key], rule.type);
    }
  }

  return transformed;
}

const COMMON_RULES: Record<string, Record<string, ValidationRule>> = {
  chat: {
    messages: {
      type: "array",
      required: true,
      items: {
        type: "object",
        required: true,
        properties: {
          role: { type: "string", required: true, enum: ["user", "assistant", "system"] },
          content: { type: "string", required: true, minLength: 1, maxLength: 100000 },
        },
      },
    },
    model: { type: "string", required: false, maxLength: 100 },
    temperature: { type: "number", required: false, minValue: 0, maxValue: 2 },
    maxTokens: { type: "number", required: false, minValue: 1, maxValue: 200000 },
    stream: { type: "boolean", required: false },
  },
  simulation: {
    config: { type: "object", required: false },
    query: { type: "string", required: false, maxLength: 10000 },
  },
  pagination: {
    limit: { type: "number", required: false, minValue: 1, maxValue: 1000 },
    offset: { type: "number", required: false, minValue: 0 },
  },
};

export async function requestValidator(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.body && typeof request.body === "object") {
      request.body = sanitizeObject(request.body);
    }

    if (request.query && typeof request.query === "object") {
      const sanitizedQuery: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(request.query as Record<string, unknown>)) {
        if (typeof value === "string") {
          sanitizedQuery[key] = sanitizeString(value);
        } else {
          sanitizedQuery[key] = value;
        }
      }
      request.query = sanitizedQuery as typeof request.query;
    }

    if (request.params && typeof request.params === "object") {
      const sanitizedParams: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(request.params as Record<string, unknown>)) {
        if (typeof value === "string") {
          sanitizedParams[key] = sanitizeString(value);
        } else {
          sanitizedParams[key] = value;
        }
      }
      request.params = sanitizedParams as typeof request.params;
    }

    if (request.body && typeof request.body === "object") {
      const body = request.body as Record<string, unknown>;
      const url = request.url;

      let rules: Record<string, ValidationRule> | undefined;
      if (url.includes("/chat")) {
        rules = COMMON_RULES.chat;
      } else if (url.includes("/simulate")) {
        rules = COMMON_RULES.simulation;
      }

      if (rules) {
        const errors = validateField(body, { type: "object", properties: rules }, "body");

        if (errors.length > 0) {
          return reply.status(400).send({
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Request validation failed",
              details: {
                errors: errors.map((e) => ({
                  field: e.field,
                  message: e.message,
                })),
              },
            },
            meta: { requestId: request.id, timestamp: new Date().toISOString() },
          });
        }

        request.body = transformBody(body, rules);
      }
    }

    if (request.query) {
      const query = request.query as Record<string, unknown>;
      if (query.limit !== undefined) {
        query.limit = coerceType(query.limit, "number");
      }
      if (query.offset !== undefined) {
        query.offset = coerceType(query.offset, "number");
      }
      request.query = query as typeof request.query;
    }
  });
}

export { validateField, sanitizeString, sanitizeObject, coerceType, transformBody, COMMON_RULES };
export type { ValidationRule, ValidationError };
