import type { LLMRequest, LLMResponse, LLMStreamChunk } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('MiddlewarePipeline');

export interface MiddlewareContext {
  request: LLMRequest;
  response?: LLMResponse;
  streamChunks?: LLMStreamChunk[];
  metadata: Record<string, unknown>;
  aborted: boolean;
  abortReason?: string;
  startTime: number;
  retries: number;
  provider: string;
  model: string;
}

export interface Middleware {
  name: string;
  order: number;
  beforeRequest?(context: MiddlewareContext): Promise<MiddlewareContext>;
  afterResponse?(context: MiddlewareContext): Promise<MiddlewareContext>;
  onError?(context: MiddlewareContext, error: Error): Promise<MiddlewareContext>;
  onStreamChunk?(context: MiddlewareContext, chunk: LLMStreamChunk): Promise<MiddlewareContext>;
}

export type MiddlewareFn = (
  context: MiddlewareContext,
  next: () => Promise<MiddlewareContext>,
) => Promise<MiddlewareContext>;

export interface MiddlewareRegistration {
  middleware: Middleware;
  enabled: boolean;
  registeredAt: number;
}

export class MiddlewarePipeline {
  private registrations: MiddlewareRegistration[] = [];
  private globalErrorHandler?: (context: MiddlewareContext, error: Error) => Promise<MiddlewareContext>;
  private executionLog: Array<{
    middleware: string;
    phase: string;
    timestamp: number;
    durationMs: number;
    error?: string;
  }> = [];
  private maxLogSize: number = 1000;

  use(middleware: Middleware): void {
    const existing = this.registrations.findIndex(
      (r) => r.middleware.name === middleware.name,
    );
    if (existing !== -1) {
      this.registrations[existing].middleware = middleware;
      logger.info('Middleware updated', { name: middleware.name, order: middleware.order });
    } else {
      this.registrations.push({
        middleware,
        enabled: true,
        registeredAt: Date.now(),
      });
      this.sortMiddlewares();
      logger.info('Middleware added', { name: middleware.name, order: middleware.order });
    }
  }

  remove(name: string): boolean {
    const index = this.registrations.findIndex(
      (r) => r.middleware.name === name,
    );
    if (index === -1) return false;
    this.registrations.splice(index, 1);
    logger.info('Middleware removed', { name });
    return true;
  }

  enable(name: string): boolean {
    const reg = this.registrations.find((r) => r.middleware.name === name);
    if (!reg) return false;
    reg.enabled = true;
    logger.info('Middleware enabled', { name });
    return true;
  }

  disable(name: string): boolean {
    const reg = this.registrations.find((r) => r.middleware.name === name);
    if (!reg) return false;
    reg.enabled = false;
    logger.info('Middleware disabled', { name });
    return true;
  }

  setGlobalErrorHandler(
    handler: (context: MiddlewareContext, error: Error) => Promise<MiddlewareContext>,
  ): void {
    this.globalErrorHandler = handler;
  }

  async execute(context: MiddlewareContext): Promise<MiddlewareContext> {
    context.startTime = context.startTime ?? Date.now();
    context = await this.executeBeforeRequest(context);
    if (context.aborted) {
      logger.warn('Pipeline aborted during beforeRequest', {
        reason: context.abortReason,
      });
      return context;
    }
    context = await this.executeAfterResponse(context);
    return context;
  }

  async executeBeforeRequest(context: MiddlewareContext): Promise<MiddlewareContext> {
    let current = context;

    for (const reg of this.registrations) {
      if (current.aborted) break;
      if (!reg.enabled) continue;

      const middleware = reg.middleware;
      if (middleware.beforeRequest) {
        const start = Date.now();
        try {
          current = await middleware.beforeRequest(current);
          this.logExecution(middleware.name, 'beforeRequest', start);
        } catch (error) {
          const err = error as Error;
          this.logExecution(middleware.name, 'beforeRequest', start, err.message);
          logger.error('Middleware beforeRequest error', {
            middleware: middleware.name,
            error: err.message,
          });

          if (middleware.onError) {
            current = await middleware.onError(current, err);
          } else if (this.globalErrorHandler) {
            current = await this.globalErrorHandler(current, err);
          }
        }
      }
    }

    return current;
  }

  async executeAfterResponse(context: MiddlewareContext): Promise<MiddlewareContext> {
    let current = context;

    for (const reg of [...this.registrations].reverse()) {
      if (current.aborted) break;
      if (!reg.enabled) continue;

      const middleware = reg.middleware;
      if (middleware.afterResponse) {
        const start = Date.now();
        try {
          current = await middleware.afterResponse(current);
          this.logExecution(middleware.name, 'afterResponse', start);
        } catch (error) {
          const err = error as Error;
          this.logExecution(middleware.name, 'afterResponse', start, err.message);
          logger.error('Middleware afterResponse error', {
            middleware: middleware.name,
            error: err.message,
          });

          if (middleware.onError) {
            current = await middleware.onError(current, err);
          } else if (this.globalErrorHandler) {
            current = await this.globalErrorHandler(current, err);
          }
        }
      }
    }

    return current;
  }

  async executeOnStreamChunk(
    context: MiddlewareContext,
    chunk: LLMStreamChunk,
  ): Promise<MiddlewareContext> {
    let current = { ...context };

    for (const reg of this.registrations) {
      if (current.aborted) break;
      if (!reg.enabled) continue;

      const middleware = reg.middleware;
      if (middleware.onStreamChunk) {
        const start = Date.now();
        try {
          current = await middleware.onStreamChunk(current, chunk);
          this.logExecution(middleware.name, 'onStreamChunk', start);
        } catch (error) {
          const err = error as Error;
          this.logExecution(middleware.name, 'onStreamChunk', start, err.message);
          logger.error('Middleware onStreamChunk error', {
            middleware: middleware.name,
            error: err.message,
          });
        }
      }
    }

    return current;
  }

  async executeOnError(context: MiddlewareContext, error: Error): Promise<MiddlewareContext> {
    let current = context;

    for (const reg of [...this.registrations].reverse()) {
      const middleware = reg.middleware;
      if (middleware.onError) {
        const start = Date.now();
        try {
          current = await middleware.onError(current, error);
          this.logExecution(middleware.name, 'onError', start);
        } catch (err) {
          const nestedErr = err as Error;
          this.logExecution(middleware.name, 'onError', start, nestedErr.message);
          logger.error('Middleware onError error', {
            middleware: middleware.name,
            error: nestedErr.message,
          });
        }
      }
    }

    if (this.globalErrorHandler && current.aborted) {
      current = await this.globalErrorHandler(current, error);
    }

    return current;
  }

  compose(): MiddlewareFn {
    const self = this;
    return async (context: MiddlewareContext, next: () => Promise<MiddlewareContext>) => {
      let current = await self.executeBeforeRequest(context);
      if (current.aborted) {
        return current;
      }
      current = await next();
      current = await self.executeAfterResponse(current);
      return current;
    };
  }

  createChain(finalHandler: (ctx: MiddlewareContext) => Promise<MiddlewareContext>): MiddlewareFn {
    const enabledMiddlewares = this.registrations
      .filter((r) => r.enabled)
      .map((r) => r.middleware);

    let chain = finalHandler;

    for (const middleware of [...enabledMiddlewares].reverse()) {
      const currentChain = chain;
      const mw = middleware;
      chain = async (ctx: MiddlewareContext) => {
        if (ctx.aborted) return ctx;
        if (mw.beforeRequest) {
          ctx = await mw.beforeRequest(ctx);
        }
        if (ctx.aborted) return ctx;
        ctx = await currentChain(ctx);
        if (ctx.aborted) return ctx;
        if (mw.afterResponse) {
          ctx = await mw.afterResponse(ctx);
        }
        return ctx;
      };
    }

    return chain as MiddlewareFn;
  }

  getMiddlewares(): string[] {
    return this.registrations.map((r) => r.middleware.name);
  }

  getEnabledMiddlewares(): string[] {
    return this.registrations
      .filter((r) => r.enabled)
      .map((r) => r.middleware.name);
  }

  hasMiddleware(name: string): boolean {
    return this.registrations.some((r) => r.middleware.name === name);
  }

  getMiddleware(name: string): Middleware | undefined {
    const reg = this.registrations.find((r) => r.middleware.name === name);
    return reg?.middleware;
  }

  getExecutionLog(): typeof this.executionLog {
    return [...this.executionLog];
  }

  clearExecutionLog(): void {
    this.executionLog = [];
  }

  clear(): void {
    this.registrations = [];
    this.executionLog = [];
  }

  private sortMiddlewares(): void {
    this.registrations.sort(
      (a, b) => a.middleware.order - b.middleware.order,
    );
  }

  private logExecution(
    middleware: string,
    phase: string,
    startTimestamp: number,
    error?: string,
  ): void {
    this.executionLog.push({
      middleware,
      phase,
      timestamp: startTimestamp,
      durationMs: Date.now() - startTimestamp,
      error,
    });
    if (this.executionLog.length > this.maxLogSize) {
      this.executionLog = this.executionLog.slice(-this.maxLogSize);
    }
  }
}
