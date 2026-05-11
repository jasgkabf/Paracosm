import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { createLogger } from '@paracosm/shared';
import { registerRoutes } from './routes/index.js';
import { WebSocketManager } from './websocket/ws-manager.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestValidator } from './middleware/request-validator.js';
import { responseFormatter } from './middleware/response-formatter.js';
import { requestLogger } from './middleware/request-logger.js';

const logger = createLogger('ParacosmServer');

export interface ServerConfig {
  host: string;
  port: number;
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
  requestTimeout: number;
  keepAliveTimeout: number;
  bodyLimit: number;
}

const DEFAULT_CONFIG: ServerConfig = {
  host: '0.0.0.0',
  port: 7529,
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
  },
  rateLimit: {
    max: 100,
    timeWindow: '1 minute',
  },
  requestTimeout: 30000,
  keepAliveTimeout: 72000,
  bodyLimit: 1048576,
};

export class ParacosmServer {
  private fastify: FastifyInstance;
  private config: ServerConfig;
  private wsManager: WebSocketManager;
  private shuttingDown: boolean = false;
  private startTime: number = Date.now();

  constructor(config?: Partial<ServerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.fastify = Fastify({
      requestTimeout: this.config.requestTimeout,
      keepAliveTimeout: this.config.keepAliveTimeout,
      bodyLimit: this.config.bodyLimit,
      logger: false,
    });

    this.wsManager = new WebSocketManager();
  }

  async initialize(): Promise<void> {
    await this.registerPlugins();
    this.registerMiddleware();
    this.registerHooks();
    registerRoutes(this.fastify, this.wsManager);
    this.registerHealthCheck();
    this.registerGracefulShutdown();

    logger.info('Server initialized', {
      host: this.config.host,
      port: this.config.port,
    });
  }

  async start(): Promise<void> {
    try {
      await this.initialize();

      const address = await this.fastify.listen({
        host: this.config.host,
        port: this.config.port,
      });

      logger.info(`Server listening on ${address}`);
      this.startTime = Date.now();
    } catch (error) {
      logger.error('Failed to start server', { error: (error as Error).message });
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    logger.info('Shutting down server...');

    this.wsManager.closeAll();

    await this.fastify.close();

    logger.info('Server shut down complete');
  }

  getFastify(): FastifyInstance {
    return this.fastify;
  }

  getWebSocketManager(): WebSocketManager {
    return this.wsManager;
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }

  private async registerPlugins(): Promise<void> {
    await this.fastify.register(cors, {
      origin: this.config.cors.origin,
      methods: this.config.cors.methods,
      allowedHeaders: this.config.cors.allowedHeaders,
      credentials: this.config.cors.credentials,
    });

    await this.fastify.register(rateLimit, {
      max: this.config.rateLimit.max,
      timeWindow: this.config.rateLimit.timeWindow,
    });

    await this.fastify.register(websocket);

    logger.info('Plugins registered');
  }

  private registerMiddleware(): void {
    this.fastify.addHook('onRequest', authMiddleware);
    this.fastify.addHook('onRequest', requestLogger);
    this.fastify.addHook('preValidation', requestValidator);
    this.fastify.addHook('onSend', responseFormatter);
    this.fastify.setErrorHandler(errorHandler);

    logger.info('Middleware registered');
  }

  private registerHooks(): void {
    this.fastify.addHook('onResponse', (_request: FastifyRequest, reply: FastifyReply, done: () => void) => {
      done();
    });

    this.fastify.addHook('onClose', async (_instance: FastifyInstance) => {
      logger.info('Fastify instance closing');
    });
  }

  private registerHealthCheck(): void {
    this.fastify.get('/health', async (_request: FastifyRequest, _reply: FastifyReply) => {
      const memoryUsage = process.memoryUsage();
      return {
        status: 'ok',
        uptime: this.getUptime(),
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        memory: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
        },
        websocket: {
          connections: this.wsManager.getConnectionCount(),
        },
      };
    });

    this.fastify.get('/ready', async (_request: FastifyRequest, _reply: FastifyReply) => {
      return { ready: true, timestamp: new Date().toISOString() };
    });

    this.fastify.get('/live', async (_request: FastifyRequest, _reply: FastifyReply) => {
      return { alive: true, timestamp: new Date().toISOString() };
    });
  }

  private registerGracefulShutdown(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

    for (const signal of signals) {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, starting graceful shutdown`);
        await this.stop();
        process.exit(0);
      });
    }

    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      this.stop().then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason: unknown) => {
      logger.error('Unhandled rejection', { reason: String(reason) });
    });
  }
}

export async function createServer(config?: Partial<ServerConfig>): Promise<ParacosmServer> {
  const server = new ParacosmServer(config);
  await server.initialize();
  return server;
}

export async function startServer(config?: Partial<ServerConfig>): Promise<ParacosmServer> {
  const server = new ParacosmServer(config);
  await server.start();
  return server;
}
