import type { FastifyInstance, FastifyRequest, FastifyReply, HookHandlerDoneFunction } from "fastify";
import { createLogger, generateId } from "@paracosm/shared";

const logger = createLogger("api:middleware:auth");

interface APIKeyRecord {
  key: string;
  userId: string;
  scopes: string[];
  name: string;
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
  createdAt: string;
}

interface JWTDecoded {
  sub: string;
  scopes: string[];
  exp: number;
  iat: number;
  iss: string;
}

interface SessionRecord {
  sessionId: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
}

const apiKeys = new Map<string, APIKeyRecord>();
const sessions = new Map<string, SessionRecord>();
const userRateLimits = new Map<string, { count: number; windowStart: number }>();

const DEFAULT_API_KEY = generateId();
apiKeys.set(DEFAULT_API_KEY, {
  key: DEFAULT_API_KEY,
  userId: "system",
  scopes: ["admin"],
  name: "default-system-key",
  rateLimit: { maxRequests: 1000, windowMs: 60000 },
  createdAt: new Date().toISOString(),
});

const PUBLIC_PATHS = new Set([
  "/health",
  "/ready",
  "/live",
]);

function extractBearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const parts = authorization.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") {
    return parts[1];
  }
  return null;
}

function extractAPIKey(request: FastifyRequest): string | null {
  const apiKeyHeader = request.headers["x-api-key"];
  if (apiKeyHeader && typeof apiKeyHeader === "string") {
    return apiKeyHeader;
  }

  const authorization = request.headers["authorization"];
  if (authorization && authorization.startsWith("ApiKey ")) {
    return authorization.substring(7);
  }

  return null;
}

function decodeJWT(token: string): JWTDecoded | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    return {
      sub: payload.sub ?? payload.userId ?? "unknown",
      scopes: payload.scopes ?? payload.permissions ?? [],
      exp: payload.exp ?? 0,
      iat: payload.iat ?? 0,
      iss: payload.iss ?? "paracosm",
    };
  } catch {
    return null;
  }
}

function checkUserRateLimit(userId: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = userRateLimits.get(userId);

  if (!record || now - record.windowStart > windowMs) {
    userRateLimits.set(userId, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.windowStart + windowMs };
  }

  record.count++;
  return { allowed: true, remaining: maxRequests - record.count, resetAt: record.windowStart + windowMs };
}

function authenticateAPIKey(apiKey: string): { authenticated: boolean; userId: string | null; scopes: string[] } | null {
  const record = apiKeys.get(apiKey);
  if (!record) return null;

  return {
    authenticated: true,
    userId: record.userId,
    scopes: record.scopes,
  };
}

function authenticateJWT(token: string): { authenticated: boolean; userId: string | null; scopes: string[] } | null {
  const decoded = decodeJWT(token);
  if (!decoded) return null;

  return {
    authenticated: true,
    userId: decoded.sub,
    scopes: decoded.scopes,
  };
}

function authenticateSession(sessionId: string): { authenticated: boolean; userId: string | null; scopes: string[] } | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  session.lastActivityAt = new Date().toISOString();

  return {
    authenticated: true,
    userId: session.userId,
    scopes: [],
  };
}

export async function authMiddleware(fastify: FastifyInstance): Promise<void> {
  fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    if (PUBLIC_PATHS.has(request.url)) {
      return;
    }

    const apiKey = extractAPIKey(request);
    if (apiKey) {
      const result = authenticateAPIKey(apiKey);
      if (result && result.authenticated) {
        request.user = { id: result.userId ?? "anonymous", scopes: result.scopes, authMethod: "api_key" };

        const keyRecord = apiKeys.get(apiKey);
        if (keyRecord) {
          const rateLimitResult = checkUserRateLimit(
            result.userId ?? "anonymous",
            keyRecord.rateLimit.maxRequests,
            keyRecord.rateLimit.windowMs
          );

          reply.header("X-RateLimit-Limit", keyRecord.rateLimit.maxRequests);
          reply.header("X-RateLimit-Remaining", rateLimitResult.remaining);
          reply.header("X-RateLimit-Reset", rateLimitResult.resetAt);

          if (!rateLimitResult.allowed) {
            return reply.status(429).send({
              success: false,
              error: {
                code: "RATE_LIMIT_EXCEEDED",
                message: "Rate limit exceeded for this API key",
                details: {
                  limit: keyRecord.rateLimit.maxRequests,
                  windowMs: keyRecord.rateLimit.windowMs,
                  resetAt: new Date(rateLimitResult.resetAt).toISOString(),
                },
              },
              meta: { requestId: request.id, timestamp: new Date().toISOString() },
            });
          }
        }

        return;
      }

      return reply.status(401).send({
        success: false,
        error: {
          code: "INVALID_API_KEY",
          message: "The provided API key is invalid",
          details: {},
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    const bearerToken = extractBearerToken(request.headers.authorization);
    if (bearerToken) {
      const jwtResult = authenticateJWT(bearerToken);
      if (jwtResult && jwtResult.authenticated) {
        request.user = { id: jwtResult.userId ?? "anonymous", scopes: jwtResult.scopes, authMethod: "jwt" };

        const rateLimitResult = checkUserRateLimit(jwtResult.userId ?? "anonymous", 100, 60000);
        reply.header("X-RateLimit-Limit", 100);
        reply.header("X-RateLimit-Remaining", rateLimitResult.remaining);
        reply.header("X-RateLimit-Reset", rateLimitResult.resetAt);

        if (!rateLimitResult.allowed) {
          return reply.status(429).send({
            success: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: "Rate limit exceeded",
              details: { resetAt: new Date(rateLimitResult.resetAt).toISOString() },
            },
            meta: { requestId: request.id, timestamp: new Date().toISOString() },
          });
        }

        return;
      }

      const sessionResult = authenticateSession(bearerToken);
      if (sessionResult && sessionResult.authenticated) {
        request.user = { id: sessionResult.userId ?? "anonymous", scopes: sessionResult.scopes, authMethod: "session" };
        return;
      }

      return reply.status(401).send({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: "The provided authentication token is invalid or expired",
          details: {},
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    const sessionHeader = request.headers["x-session-id"];
    if (sessionHeader && typeof sessionHeader === "string") {
      const sessionResult = authenticateSession(sessionHeader);
      if (sessionResult && sessionResult.authenticated) {
        request.user = { id: sessionResult.userId ?? "anonymous", scopes: sessionResult.scopes, authMethod: "session" };
        return;
      }

      return reply.status(401).send({
        success: false,
        error: {
          code: "INVALID_SESSION",
          message: "The provided session is invalid or expired",
          details: {},
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    request.user = { id: "anonymous", scopes: [], authMethod: "none" };
  });

  fastify.decorateRequest("user", null as { id: string; scopes: string[]; authMethod: string } | null);
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: {
      id: string;
      scopes: string[];
      authMethod: string;
    } | null;
  }
}
