import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createLogger } from "@paracosm/shared";

const logger = createLogger("api:middleware:request-logger");

interface RequestLogEntry {
  requestId: string;
  method: string;
  url: string;
  path: string;
  query: Record<string, unknown>;
  clientIp: string;
  userAgent: string;
  userId: string | null;
  authMethod: string | null;
  contentType: string | null;
  contentLength: number | null;
  timestamp: string;
}

interface ResponseLogEntry {
  requestId: string;
  statusCode: number;
  duration: number;
  contentLength: number | null;
  timestamp: string;
}

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "x-api-key",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "www-authenticate",
]);

const SENSITIVE_BODY_FIELDS = new Set([
  "password",
  "secret",
  "apiKey",
  "api_key",
  "token",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "privateKey",
  "private_key",
  "credentials",
]);

const auditLog: Array<{
  request: RequestLogEntry;
  response: ResponseLogEntry | null;
}> = [];

const MAX_AUDIT_LOG_SIZE = 10000;

function filterSensitiveData(data: Record<string, unknown>, sensitiveFields: Set<string>): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (sensitiveFields.has(key)) {
      filtered[key] = "[REDACTED]";
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      filtered[key] = filterSensitiveData(value as Record<string, unknown>, sensitiveFields);
    } else {
      filtered[key] = value;
    }
  }
  return filtered;
}

function filterHeaders(headers: Record<string, string | string[] | undefined>): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
      filtered[key] = "[REDACTED]";
    } else {
      filtered[key] = value;
    }
  }
  return filtered;
}

function filterBody(body: unknown): unknown {
  if (body === null || body === undefined) return body;
  if (typeof body !== "object") return body;
  if (Array.isArray(body)) return `[Array: ${body.length} items]`;

  return filterSensitiveData(body as Record<string, unknown>, SENSITIVE_BODY_FIELDS);
}

function extractClientIp(request: FastifyRequest): string {
  const forwarded = request.headers["x-forwarded-for"];
  if (forwarded && typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers["x-real-ip"];
  if (realIp && typeof realIp === "string") {
    return realIp;
  }
  return request.ip;
}

function addToAuditLog(entry: { request: RequestLogEntry; response: ResponseLogEntry | null }): void {
  auditLog.push(entry);
  if (auditLog.length > MAX_AUDIT_LOG_SIZE) {
    auditLog.shift();
  }
}

export async function requestLogger(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("onRequest", async (request: FastifyRequest) => {
    const startTime = Date.now();
    (request as any)._startTime = startTime;

    const requestLog: RequestLogEntry = {
      requestId: request.id,
      method: request.method,
      url: request.url,
      path: request.url.split("?")[0],
      query: filterSensitiveData(request.query as Record<string, unknown> ?? {}, SENSITIVE_BODY_FIELDS),
      clientIp: extractClientIp(request),
      userAgent: request.headers["user-agent"] ?? "unknown",
      userId: request.user?.id ?? null,
      authMethod: request.user?.authMethod ?? null,
      contentType: request.headers["content-type"] ?? null,
      contentLength: request.headers["content-length"]
        ? parseInt(request.headers["content-length"], 10)
        : null,
      timestamp: new Date().toISOString(),
    };

    (request as any)._requestLog = requestLog;

    logger.info("Incoming request", {
      requestId: requestLog.requestId,
      method: requestLog.method,
      path: requestLog.path,
      clientIp: requestLog.clientIp,
      userId: requestLog.userId,
    });
  });

  fastify.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = (request as any)._startTime ?? Date.now();
    const duration = Date.now() - startTime;

    const requestLog = (request as any)._requestLog as RequestLogEntry | undefined;

    const responseLog: ResponseLogEntry = {
      requestId: request.id,
      statusCode: reply.statusCode,
      duration,
      contentLength: reply.getHeader("content-length")
        ? parseInt(reply.getHeader("content-length") as string, 10)
        : null,
      timestamp: new Date().toISOString(),
    };

    if (requestLog) {
      addToAuditLog({ request: requestLog, response: responseLog });
    }

    const logContext: Record<string, unknown> = {
      requestId: request.id,
      method: request.method,
      path: request.url.split("?")[0],
      statusCode: reply.statusCode,
      duration,
      clientIp: extractClientIp(request),
    };

    if (reply.statusCode >= 500) {
      logger.error("Request completed with server error", undefined, logContext);
    } else if (reply.statusCode >= 400) {
      logger.warn("Request completed with client error", logContext);
    } else {
      logger.info("Request completed", logContext);
    }
  });
}

export function getAuditLog(options: {
  limit?: number;
  offset?: number;
  method?: string;
  statusCode?: number;
  userId?: string;
}): Array<{ request: RequestLogEntry; response: ResponseLogEntry | null }> {
  let results = [...auditLog];

  if (options.method) {
    results = results.filter((e) => e.request.method === options.method);
  }
  if (options.statusCode) {
    results = results.filter((e) => e.response?.statusCode === options.statusCode);
  }
  if (options.userId) {
    results = results.filter((e) => e.request.userId === options.userId);
  }

  results.sort((a, b) =>
    new Date(b.request.timestamp).getTime() - new Date(a.request.timestamp).getTime()
  );

  const offset = options.offset ?? 0;
  const limit = options.limit ?? 50;

  return results.slice(offset, offset + limit);
}

export { filterSensitiveData, filterHeaders, filterBody, extractClientIp };
export type { RequestLogEntry, ResponseLogEntry };
