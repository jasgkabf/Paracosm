import type { FastifyRequest } from "fastify";
import { createLogger, generateId } from "@paracosm/shared";

const logger = createLogger("api:ws:auth");

interface AuthToken {
  token: string;
  userId: string;
  scopes: string[];
  expiresAt: string;
  createdAt: string;
}

interface Session {
  sessionId: string;
  userId: string;
  connectionId: string;
  createdAt: string;
  lastActivityAt: string;
  scopes: string[];
  rooms: string[];
}

const API_KEYS = new Map<string, {
  key: string;
  userId: string;
  scopes: string[];
  name: string;
  createdAt: string;
}>();

const JWT_SECRETS = new Set<string>();
const SESSIONS = new Map<string, Session>();

const VALID_SCOPES = new Set([
  "chat:read",
  "chat:write",
  "simulation:read",
  "simulation:write",
  "world:read",
  "world:write",
  "strategy:read",
  "strategy:write",
  "tools:read",
  "tools:execute",
  "config:read",
  "config:write",
  "heartbeat:read",
  "user:read",
  "user:write",
  "admin",
]);

export class WSAuth {
  private defaultApiKey: string;

  constructor() {
    this.defaultApiKey = generateId();
    API_KEYS.set(this.defaultApiKey, {
      key: this.defaultApiKey,
      userId: "system",
      scopes: Array.from(VALID_SCOPES),
      name: "default-system-key",
      createdAt: new Date().toISOString(),
    });
    JWT_SECRETS.add("paracosm-default-jwt-secret");
  }

  authenticate(request: FastifyRequest): {
    authenticated: boolean;
    userId: string | null;
    scopes: string[];
    method: string | null;
    error: string | null;
  } {
    const authHeader = request.headers["authorization"];
    const apiKeyHeader = request.headers["x-api-key"];
    const protocolHeader = request.headers["sec-websocket-protocol"];

    if (apiKeyHeader && typeof apiKeyHeader === "string") {
      return this.authenticateByApiKey(apiKeyHeader);
    }

    if (authHeader && typeof authHeader === "string") {
      if (authHeader.startsWith("Bearer ")) {
        return this.authenticateByBearerToken(authHeader.substring(7));
      }
      if (authHeader.startsWith("ApiKey ")) {
        return this.authenticateByApiKey(authHeader.substring(7));
      }
    }

    if (protocolHeader && typeof protocolHeader === "string") {
      const protocols = protocolHeader.split(",").map((p) => p.trim());
      for (const protocol of protocols) {
        if (protocol.startsWith("paracosm-")) {
          const token = protocol.substring(9);
          return this.authenticateByApiKey(token);
        }
      }
    }

    return {
      authenticated: false,
      userId: null,
      scopes: [],
      method: null,
      error: "No authentication credentials provided",
    };
  }

  private authenticateByApiKey(apiKey: string): {
    authenticated: boolean;
    userId: string | null;
    scopes: string[];
    method: string | null;
    error: string | null;
  } {
    const keyData = API_KEYS.get(apiKey);
    if (!keyData) {
      logger.warn("Invalid API key attempt", { keyPrefix: apiKey.substring(0, 4) });
      return {
        authenticated: false,
        userId: null,
        scopes: [],
        method: "api_key",
        error: "Invalid API key",
      };
    }

    return {
      authenticated: true,
      userId: keyData.userId,
      scopes: keyData.scopes,
      method: "api_key",
      error: null,
    };
  }

  private authenticateByBearerToken(token: string): {
    authenticated: boolean;
    userId: string | null;
    scopes: string[];
    method: string | null;
    error: string | null;
  } {
    if (!token || token.length < 16) {
      return {
        authenticated: false,
        userId: null,
        scopes: [],
        method: "bearer",
        error: "Invalid bearer token",
      };
    }

    const parts = token.split(".");
    if (parts.length === 3) {
      return this.authenticateByJWT(token);
    }

    const keyData = API_KEYS.get(token);
    if (keyData) {
      return {
        authenticated: true,
        userId: keyData.userId,
        scopes: keyData.scopes,
        method: "bearer",
        error: null,
      };
    }

    return {
      authenticated: false,
      userId: null,
      scopes: [],
      method: "bearer",
      error: "Invalid bearer token",
    };
  }

  private authenticateByJWT(token: string): {
    authenticated: boolean;
    userId: string | null;
    scopes: string[];
    method: string | null;
    error: string | null;
  } {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        return {
          authenticated: false,
          userId: null,
          scopes: [],
          method: "jwt",
          error: "Invalid JWT format",
        };
      }

      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

      if (payload.exp && payload.exp < Date.now() / 1000) {
        return {
          authenticated: false,
          userId: null,
          scopes: [],
          method: "jwt",
          error: "Token expired",
        };
      }

      const userId = payload.sub ?? payload.userId ?? null;
      if (!userId) {
        return {
          authenticated: false,
          userId: null,
          scopes: [],
          method: "jwt",
          error: "Token missing subject",
        };
      }

      const scopes = payload.scopes ?? payload.permissions ?? [];
      const validScopes = scopes.filter((s: string) => VALID_SCOPES.has(s));

      return {
        authenticated: true,
        userId,
        scopes: validScopes,
        method: "jwt",
        error: null,
      };
    } catch {
      return {
        authenticated: false,
        userId: null,
        scopes: [],
        method: "jwt",
        error: "Invalid JWT token",
      };
    }
  }

  authorize(userId: string, scope: string): boolean {
    for (const [, keyData] of API_KEYS) {
      if (keyData.userId === userId) {
        if (keyData.scopes.includes("admin") || keyData.scopes.includes(scope)) {
          return true;
        }
      }
    }
    return false;
  }

  createSession(userId: string, connectionId: string, scopes: string[]): Session {
    const sessionId = generateId();
    const session: Session = {
      sessionId,
      userId,
      connectionId,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      scopes,
      rooms: [],
    };
    SESSIONS.set(sessionId, session);
    logger.info("Session created", { sessionId, userId, connectionId });
    return session;
  }

  getSession(sessionId: string): Session | null {
    return SESSIONS.get(sessionId) ?? null;
  }

  updateSessionActivity(sessionId: string): void {
    const session = SESSIONS.get(sessionId);
    if (session) {
      session.lastActivityAt = new Date().toISOString();
    }
  }

  addSessionToRoom(sessionId: string, room: string): void {
    const session = SESSIONS.get(sessionId);
    if (session && !session.rooms.includes(room)) {
      session.rooms.push(room);
    }
  }

  removeSessionFromRoom(sessionId: string, room: string): void {
    const session = SESSIONS.get(sessionId);
    if (session) {
      session.rooms = session.rooms.filter((r) => r !== room);
    }
  }

  destroySession(sessionId: string): void {
    SESSIONS.delete(sessionId);
    logger.info("Session destroyed", { sessionId });
  }

  getSessionsByUser(userId: string): Session[] {
    return Array.from(SESSIONS.values()).filter((s) => s.userId === userId);
  }

  getSessionsByRoom(room: string): Session[] {
    return Array.from(SESSIONS.values()).filter((s) => s.rooms.includes(room));
  }

  validateToken(token: string): { valid: boolean; userId: string | null; scopes: string[] } {
    const keyData = API_KEYS.get(token);
    if (keyData) {
      return { valid: true, userId: keyData.userId, scopes: keyData.scopes };
    }

    const parts = token.split(".");
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
        if (payload.exp && payload.exp < Date.now() / 1000) {
          return { valid: false, userId: null, scopes: [] };
        }
        return {
          valid: true,
          userId: payload.sub ?? payload.userId ?? null,
          scopes: payload.scopes ?? [],
        };
      } catch {
        return { valid: false, userId: null, scopes: [] };
      }
    }

    return { valid: false, userId: null, scopes: [] };
  }

  registerApiKey(key: string, userId: string, scopes: string[], name: string): void {
    API_KEYS.set(key, {
      key,
      userId,
      scopes,
      name,
      createdAt: new Date().toISOString(),
    });
    logger.info("API key registered", { userId, name, scopeCount: scopes.length });
  }

  revokeApiKey(key: string): boolean {
    return API_KEYS.delete(key);
  }
}
