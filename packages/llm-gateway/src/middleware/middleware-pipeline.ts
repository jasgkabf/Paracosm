import { EventEmitter } from "node:events";
import { Result, ok, err } from "@paracosm/shared";
import { LLMError } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";

const logger = new Logger("MiddlewarePipeline");

export interface MiddlewareContext {
  request: Record<string, unknown>;
  response?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  aborted: boolean;
  startTime: number;
}

export type MiddlewareFn = (ctx: MiddlewareContext, next: () => Promise<void>) => Promise<void>;

export class MiddlewarePipeline extends EventEmitter {
  private middlewares: { name: string; fn: MiddlewareFn; order: number }[] = [];
  private errorHandler: ((error: Error, ctx: MiddlewareContext) => void) | null = null;

  use(name: string, fn: MiddlewareFn, order: number = 0): void {
    this.middlewares.push({ name, fn, order });
    this.middlewares.sort((a, b) => a.order - b.order);
    logger.info(`Middleware registered: ${name} (order: ${order})`);
  }

  async execute(ctx: MiddlewareContext): Promise<Result<MiddlewareContext, Error>> {
    const sorted = [...this.middlewares].sort((a, b) => a.order - b.order);

    let index = 0;

    const next = async (): Promise<void> => {
      if (ctx.aborted) {
        return;
      }

      if (index >= sorted.length) {
        return;
      }

      const middleware = sorted[index];
      index++;

      try {
        await middleware.fn(ctx, next);
      } catch (error) {
        const errObj = error instanceof Error ? error : new Error(String(error));
        if (this.errorHandler) {
          this.errorHandler(errObj, ctx);
        } else {
          ctx.aborted = true;
          throw errObj;
        }
      }
    };

    try {
      await next();
      return ok(ctx);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  compose(): MiddlewareFn {
    const sorted = [...this.middlewares].sort((a, b) => a.order - b.order);

    return async (ctx: MiddlewareContext, next: () => Promise<void>): Promise<void> => {
      let index = 0;

      const dispatch = async (): Promise<void> => {
        if (ctx.aborted || index >= sorted.length) {
          return next();
        }

        const middleware = sorted[index];
        index++;

        await middleware.fn(ctx, dispatch);
      };

      await dispatch();
    };
  }

  onError(handler: (error: Error, ctx: MiddlewareContext) => void): void {
    this.errorHandler = handler;
  }

  remove(name: string): boolean {
    const idx = this.middlewares.findIndex((m) => m.name === name);
    if (idx !== -1) {
      this.middlewares.splice(idx, 1);
      return true;
    }
    return false;
  }

  getMiddlewares(): { name: string; order: number }[] {
    return this.middlewares.map((m) => ({ name: m.name, order: m.order }));
  }

  has(name: string): boolean {
    return this.middlewares.some((m) => m.name === name);
  }

  clear(): void {
    this.middlewares = [];
  }
}
