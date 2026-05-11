export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: Record<string, unknown>;
}

export function formatLogEntry(entry: LogEntry): string {
  const timestamp = entry.timestamp;
  const level = entry.level.toUpperCase().padEnd(5);
  const context = entry.context ? `[${entry.context}]` : '';
  const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
  return `${timestamp} ${level} ${context} ${entry.message}${data}`;
}

export class Logger {
  private minLevel: LogLevel;
  private context: string;
  private handlers: Array<(entry: LogEntry) => void>;

  constructor(
    minLevel: LogLevel = 'info',
    context: string = '',
    handlers: Array<(entry: LogEntry) => void> = [],
  ) {
    this.minLevel = minLevel;
    this.context = context;
    this.handlers = handlers;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) {
      return;
    }
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: this.context || undefined,
      data,
    };
    const formatted = formatLogEntry(entry);
    if (level === 'error' || level === 'fatal') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
    for (const handler of this.handlers) {
      handler(entry);
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  fatal(message: string, data?: Record<string, unknown>): void {
    this.log('fatal', message, data);
  }

  child(context: string): Logger {
    const childContext = this.context
      ? `${this.context}:${context}`
      : context;
    return new Logger(this.minLevel, childContext, this.handlers);
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  addHandler(handler: (entry: LogEntry) => void): void {
    this.handlers.push(handler);
  }
}

export function createLogger(
  context: string,
  minLevel: LogLevel = 'info',
): Logger {
  return new Logger(minLevel, context);
}
