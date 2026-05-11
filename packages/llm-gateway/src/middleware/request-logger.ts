import { createLogger, generateId } from '@paracosm/shared';
import type { Middleware, MiddlewareContext } from './middleware-pipeline.js';

const logger = createLogger('RequestLogger');

export interface LogEntry {
  id: string;
  requestId: string;
  method: string;
  path: string;
  provider: string;
  model: string;
  requestSize: number;
  responseSize: number;
  statusCode: number;
  durationMs: number;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  resource: string;
  result: 'success' | 'failure' | 'denied';
  timestamp: number;
  details: Record<string, unknown>;
}

export interface LogRotationConfig {
  maxFileSize: number;
  maxFiles: number;
  rotateIntervalMs: number;
  compress: boolean;
}

const SENSITIVE_FIELDS = [
  'apiKey',
  'api_key',
  'authorization',
  'password',
  'secret',
  'token',
  'credential',
  'privateKey',
  'private_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
];

export class RequestLogger implements Middleware {
  name = 'request-logger';
  order = 1;

  private logs: LogEntry[] = [];
  private auditTrail: AuditEntry[] = [];
  private maxLogs: number = 5000;
  private maxAuditEntries: number = 10000;
  private rotationConfig: LogRotationConfig;
  private sanitizeEnabled: boolean = true;
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  private rotationTimer: ReturnType<typeof setInterval> | null = null;
  private currentLogSize: number = 0;

  constructor(config?: {
    maxLogs?: number;
    maxAuditEntries?: number;
    sanitize?: boolean;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    rotation?: Partial<LogRotationConfig>;
  }) {
    this.maxLogs = config?.maxLogs ?? 5000;
    this.maxAuditEntries = config?.maxAuditEntries ?? 10000;
    this.sanitizeEnabled = config?.sanitize ?? true;
    this.logLevel = config?.logLevel ?? 'info';
    this.rotationConfig = {
      maxFileSize: config?.rotation?.maxFileSize ?? 10 * 1024 * 1024,
      maxFiles: config?.rotation?.maxFiles ?? 5,
      rotateIntervalMs: config?.rotation?.rotateIntervalMs ?? 3600000,
      compress: config?.rotation?.compress ?? true,
    };

    this.rotationTimer = setInterval(
      () => this.rotate(),
      this.rotationConfig.rotateIntervalMs,
    );
  }

  async beforeRequest(context: MiddlewareContext): Promise<MiddlewareContext> {
    const entry: LogEntry = {
      id: generateId(),
      requestId: context.request.id,
      method: 'POST',
      path: `/llm/${context.request.provider}`,
      provider: context.request.provider,
      model: context.request.model,
      requestSize: context.request.prompt.length,
      responseSize: 0,
      statusCode: 0,
      durationMs: 0,
      timestamp: Date.now(),
      metadata: this.sanitizeEnabled
        ? this.sanitize(context.metadata)
        : { ...context.metadata },
    };

    context.metadata._logEntryId = entry.id;
    context.metadata._requestStartTime = Date.now();

    this.log(entry);

    return context;
  }

  async afterResponse(context: MiddlewareContext): Promise<MiddlewareContext> {
    if (!context.response) return context;

    const startTime = context.metadata._requestStartTime as number ?? Date.now();
    const entry: LogEntry = {
      id: generateId(),
      requestId: context.request.id,
      method: 'POST',
      path: `/llm/${context.response.provider}`,
      provider: context.response.provider,
      model: context.response.model,
      requestSize: context.request.prompt.length,
      responseSize: context.response.content.length,
      statusCode: 200,
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
      metadata: this.sanitizeEnabled
        ? this.sanitize(context.metadata)
        : { ...context.metadata },
    };

    this.log(entry);
    this.audit('llm_request', 'system', `${context.response.provider}/${context.response.model}`, 'success', {
      requestId: context.request.id,
      tokens: context.response.usage.totalTokens,
      durationMs: entry.durationMs,
    });

    return context;
  }

  async onError(context: MiddlewareContext, error: Error): Promise<MiddlewareContext> {
    const startTime = context.metadata._requestStartTime as number ?? Date.now();
    const entry: LogEntry = {
      id: generateId(),
      requestId: context.request.id,
      method: 'POST',
      path: `/llm/${context.request.provider}`,
      provider: context.request.provider,
      model: context.request.model,
      requestSize: context.request.prompt.length,
      responseSize: 0,
      statusCode: 500,
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
      metadata: {
        error: error.message,
        errorName: error.name,
        ...(this.sanitizeEnabled
          ? this.sanitize(context.metadata)
          : context.metadata),
      },
    };

    this.log(entry);
    this.audit('llm_request_error', 'system', `${context.request.provider}/${context.request.model}`, 'failure', {
      requestId: context.request.id,
      error: error.message,
    });

    return context;
  }

  log(entry: LogEntry): void {
    this.logs.push(entry);
    this.currentLogSize += JSON.stringify(entry).length;

    if (this.logs.length > this.maxLogs) {
      const removed = this.logs.splice(0, this.logs.length - this.maxLogs);
      for (const r of removed) {
        this.currentLogSize -= JSON.stringify(r).length;
      }
    }

    switch (this.logLevel) {
      case 'debug':
        logger.debug('Request log', { id: entry.id, provider: entry.provider, model: entry.model, duration: entry.durationMs });
        break;
      case 'info':
        logger.info('Request completed', { id: entry.id, provider: entry.provider, duration: entry.durationMs, status: entry.statusCode });
        break;
      case 'warn':
        if (entry.statusCode >= 400) {
          logger.warn('Request warning', { id: entry.id, status: entry.statusCode, duration: entry.durationMs });
        }
        break;
      case 'error':
        if (entry.statusCode >= 500) {
          logger.error('Request error', { id: entry.id, status: entry.statusCode, error: entry.metadata.error });
        }
        break;
    }
  }

  audit(
    action: string,
    actor: string,
    resource: string,
    result: 'success' | 'failure' | 'denied',
    details: Record<string, unknown> = {},
  ): void {
    const entry: AuditEntry = {
      id: generateId(),
      action,
      actor,
      resource,
      result,
      timestamp: Date.now(),
      details: this.sanitizeEnabled ? this.sanitize(details) : details,
    };

    this.auditTrail.push(entry);
    if (this.auditTrail.length > this.maxAuditEntries) {
      this.auditTrail = this.auditTrail.slice(-this.maxAuditEntries);
    }

    logger.info('Audit entry', {
      action: entry.action,
      actor: entry.actor,
      resource: entry.resource,
      result: entry.result,
    });
  }

  sanitize(data: Record<string, unknown>): Record<string, unknown> {
    if (!this.sanitizeEnabled) return data;
    return this.deepSanitize(data);
  }

  rotate(): void {
    if (this.currentLogSize < this.rotationConfig.maxFileSize) return;

    logger.info('Rotating logs', {
      currentSize: this.currentLogSize,
      maxSize: this.rotationConfig.maxFileSize,
      entries: this.logs.length,
    });

    const cutoff = Date.now() - this.rotationConfig.rotateIntervalMs;
    const oldCount = this.logs.length;
    this.logs = this.logs.filter((log) => log.timestamp > cutoff);
    const removed = oldCount - this.logs.length;

    this.currentLogSize = this.logs.reduce((sum, log) => sum + JSON.stringify(log).length, 0);

    logger.info('Log rotation complete', { removedEntries: removed, remainingEntries: this.logs.length });
  }

  getLogs(filter?: {
    provider?: string;
    model?: string;
    statusCode?: number;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): LogEntry[] {
    let result = [...this.logs];

    if (filter?.provider) {
      result = result.filter((l) => l.provider === filter.provider);
    }
    if (filter?.model) {
      result = result.filter((l) => l.model === filter.model);
    }
    if (filter?.statusCode) {
      result = result.filter((l) => l.statusCode === filter.statusCode);
    }
    if (filter?.startTime) {
      result = result.filter((l) => l.timestamp >= filter.startTime!);
    }
    if (filter?.endTime) {
      result = result.filter((l) => l.timestamp <= filter.endTime!);
    }

    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  getAuditTrail(filter?: {
    action?: string;
    actor?: string;
    result?: 'success' | 'failure' | 'denied';
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): AuditEntry[] {
    let result = [...this.auditTrail];

    if (filter?.action) {
      result = result.filter((a) => a.action === filter.action);
    }
    if (filter?.actor) {
      result = result.filter((a) => a.actor === filter.actor);
    }
    if (filter?.result) {
      result = result.filter((a) => a.result === filter.result);
    }
    if (filter?.startTime) {
      result = result.filter((a) => a.timestamp >= filter.startTime!);
    }
    if (filter?.endTime) {
      result = result.filter((a) => a.timestamp <= filter.endTime!);
    }
    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  getStats(): {
    totalRequests: number;
    averageDurationMs: number;
    errorRate: number;
    requestsByProvider: Record<string, number>;
    requestsByModel: Record<string, number>;
    auditEntries: number;
    logSizeBytes: number;
  } {
    const totalRequests = this.logs.length;
    const durations = this.logs.map((l) => l.durationMs);
    const averageDurationMs = totalRequests > 0
      ? durations.reduce((sum, d) => sum + d, 0) / totalRequests
      : 0;
    const errors = this.logs.filter((l) => l.statusCode >= 400).length;
    const errorRate = totalRequests > 0 ? errors / totalRequests : 0;

    const requestsByProvider: Record<string, number> = {};
    const requestsByModel: Record<string, number> = {};
    for (const log of this.logs) {
      requestsByProvider[log.provider] = (requestsByProvider[log.provider] ?? 0) + 1;
      requestsByModel[log.model] = (requestsByModel[log.model] ?? 0) + 1;
    }

    return {
      totalRequests,
      averageDurationMs,
      errorRate,
      requestsByProvider,
      requestsByModel,
      auditEntries: this.auditTrail.length,
      logSizeBytes: this.currentLogSize,
    };
  }

  destroy(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
  }

  clear(): void {
    this.logs = [];
    this.auditTrail = [];
    this.currentLogSize = 0;
  }

  private deepSanitize(obj: Record<string, unknown>, depth: number = 0): Record<string, unknown> {
    if (depth > 10) return {};
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
        result[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.deepSanitize(value as Record<string, unknown>, depth + 1);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === 'object' && item !== null
            ? this.deepSanitize(item as Record<string, unknown>, depth + 1)
            : item,
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}
