import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import staticPlugin from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import { createLogger } from "@paracosm/shared";
import { DEFAULT_PORT, DEFAULT_HOST, API_PREFIX, WEBSOCKET_PATH } from "@paracosm/shared";
import { registerRoutes } from "./routes/index.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";
import { responseFormatter } from "./middleware/response-formatter.js";
import { authMiddleware } from "./middleware/auth.js";
import { WSManager } from "./websocket/ws-manager.js";

const logger = createLogger("api:server");

export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string | string[];
    methods: string[];
    allowedHeaders: string[];
    credentials: boolean;
  };
  rateLimit: {
    max: number;
    timeWindow: string;
  };
  bodyLimit: number;
  requestTimeout: number;
  keepAliveTimeout: number;
  staticDir: string | null;
}

export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  port: DEFAULT_PORT,
  host: DEFAULT_HOST,
  cors: {
    origin: true as unknown as string | string[],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "X-Correlation-Id", "X-API-Key"],
    credentials: true,
  },
  rateLimit: {
    max: 100,
    timeWindow: "1 minute",
  },
  bodyLimit: 10 * 1024 * 1024,
  requestTimeout: 30000,
  keepAliveTimeout: 7200,
  staticDir: null,
};

export async function createServer(config: Partial<ServerConfig> = {}) {
  const resolvedConfig: ServerConfig = { ...DEFAULT_SERVER_CONFIG, ...config };

  const fastify = Fastify({
    logger: false,
    bodyLimit: resolvedConfig.bodyLimit,
    requestTimeout: resolvedConfig.requestTimeout,
    keepAliveTimeout: resolvedConfig.keepAliveTimeout,
    ignoreTrailingSlash: true,
    maxParamLength: 256,
  });

  await fastify.register(cors, {
    origin: resolvedConfig.cors.origin,
    methods: resolvedConfig.cors.methods,
    allowedHeaders: resolvedConfig.cors.allowedHeaders,
    credentials: resolvedConfig.cors.credentials,
  });

  await fastify.register(rateLimit, {
    max: resolvedConfig.rateLimit.max,
    timeWindow: resolvedConfig.rateLimit.timeWindow,
    cache: 10000,
    allowList: ["127.0.0.1"],
    redis: null,
    nameSpace: "paracosm:ratelimit:",
    continueExceeding: true,
  });

  await fastify.register(websocket, {
    options: {
      maxPayload: 1048576,
      verifyClient: (info: { req: { headers: Record<string, string | string[] | undefined> } }, callback: (ok: boolean, code?: number, message?: string) => void) => {
        const protocol = info.req.headers["sec-websocket-protocol"] ?? "";
        if (protocol && protocol.length > 256) {
          callback(false, 400, "Invalid protocol");
          return;
        }
        callback(true);
      },
    },
  });

  if (resolvedConfig.staticDir) {
    await fastify.register(staticPlugin, {
      root: resolvedConfig.staticDir,
      prefix: "/static/",
      decorateReply: false,
    });
  }

  const wsManager = new WSManager();
  fastify.decorate("wsManager", wsManager);

  await fastify.register(errorHandler);
  await fastify.register(requestLogger);
  await fastify.register(responseFormatter);
  await fastify.register(authMiddleware);

  fastify.addHook("onRequest", async (request, reply) => {
    const requestId = request.headers["x-request-id"] as string | undefined
      ?? crypto.randomUUID();
    request.id = requestId;
    reply.header("X-Request-Id", requestId);
  });

  fastify.addHook("onResponse", async (request, reply) => {
    const duration = reply.elapsedTime;
    reply.header("X-Response-Time", `${duration.toFixed(2)}ms`);
  });

  fastify.get("/health", async (request, reply) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      version: "0.1.0",
      services: {
        api: "healthy",
        websocket: wsManager.getConnectionCount() > 0 ? "healthy" : "idle",
        memory: {
          rss: memoryUsage.rss,
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          arrayBuffers: memoryUsage.arrayBuffers,
        },
      },
      connections: {
        active: wsManager.getConnectionCount(),
        rooms: wsManager.getRoomCount(),
      },
    };
    return reply.status(200).send(health);
  });

  fastify.get("/ready", async (request, reply) => {
    return reply.status(200).send({ ready: true, timestamp: new Date().toISOString() });
  });

  fastify.get("/live", async (request, reply) => {
    return reply.status(200).send({ alive: true });
  });

  await registerRoutes(fastify, wsManager);

  fastify.get(WEBSOCKET_PATH, { websocket: true }, (socket, request) => {
    wsManager.handleConnection(socket, request);
  });

  fastify.setNotFoundHandler(async (request, reply) => {
    return reply.status(404).send({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Route ${request.method} ${request.url} not found`,
        details: {},
      },
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown`);
    const shutdownTimeout = setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);

    try {
      wsManager.broadcast("system/notification", {
        type: "shutdown",
        message: "Server is shutting down",
        timestamp: new Date().toISOString(),
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      wsManager.closeAll();

      await fastify.close();
      clearTimeout(shutdownTimeout);
      logger.info("Server shutdown complete");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown", error as Error);
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2"));

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", error);
    gracefulShutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", reason as Error);
  });

  return { fastify, config: resolvedConfig, wsManager };
}

export async function startServer(config: Partial<ServerConfig> = {}) {
  const { fastify, config: resolvedConfig } = await createServer(config);

  try {
    const address = await fastify.listen({
      port: resolvedConfig.port,
      host: resolvedConfig.host,
    });
    logger.info(`Paracosm API server listening on ${address}`);
    logger.info(`API prefix: ${API_PREFIX}`);
    logger.info(`WebSocket path: ${WEBSOCKET_PATH}`);
    logger.info(`Health check: http://${resolvedConfig.host}:${resolvedConfig.port}/health`);
    return fastify;
  } catch (error) {
    logger.error("Failed to start server", error as Error);
    process.exit(1);
  }
}

if (typeof require !== "undefined" && require.main === module) {
  startServer();
}
