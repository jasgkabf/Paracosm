import { mkdir, readdir, unlink, stat, rename } from "node:fs/promises";
import { join } from "node:path";
import { createWriteStream } from "node:fs";

export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  name: string;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

export interface LoggerOptions {
  level?: LogLevel;
  console?: boolean;
  file?: string;
  context?: Record<string, unknown>;
}

export interface LogTransport {
  log(entry: LogEntry): void;
}

class ConsoleTransport implements LogTransport {
  log(entry: LogEntry): void {
    const formatted = formatLogEntry(entry);
    switch (entry.level) {
      case LogLevel.Debug:
        process.stdout.write(formatted + "\n");
        break;
      case LogLevel.Info:
        process.stdout.write(formatted + "\n");
        break;
      case LogLevel.Warn:
        process.stderr.write(formatted + "\n");
        break;
      case LogLevel.Error:
        process.stderr.write(formatted + "\n");
        break;
    }
  }
}

class FileTransport implements LogTransport {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  log(entry: LogEntry): void {
    const formatted = formatLogEntry(entry) + "\n";
    try {
      const stream = createWriteStream(this.filePath, { flags: "a" });
      stream.write(formatted);
      stream.end();
    } catch {
      process.stderr.write(`Failed to write log to file: ${this.filePath}\n`);
    }
  }
}

export class Logger {
  private name: string;
  private level: LogLevel;
  private transports: LogTransport[];
  private defaultContext: Record<string, unknown>;

  constructor(name: string, options: LoggerOptions = {}) {
    this.name = name;
    this.level = options.level ?? LogLevel.Info;
    this.transports = [];
    this.defaultContext = options.context ?? {};

    if (options.console !== false) {
      this.transports.push(new ConsoleTransport());
    }

    if (options.file) {
      this.transports.push(new FileTransport(options.file));
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private write(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      name: this.name,
      message,
      context: { ...this.defaultContext, ...context },
      error,
    };
    for (const transport of this.transports) {
      transport.log(entry);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.write(LogLevel.Debug, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.write(LogLevel.Info, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.write(LogLevel.Warn, message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.write(LogLevel.Error, message, context, error);
  }

  child(name: string, context?: Record<string, unknown>): Logger {
    const childLogger = new Logger(`${this.name}:${name}`, {
      level: this.level,
      console: false,
    });
    childLogger.defaultContext = { ...this.defaultContext, ...context };
    childLogger.transports = [...this.transports];
    return childLogger;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }
}

const LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.Debug]: "DEBUG",
  [LogLevel.Info]: "INFO",
  [LogLevel.Warn]: "WARN",
  [LogLevel.Error]: "ERROR",
};

export function formatLogEntry(entry: LogEntry): string {
  const timestamp = entry.timestamp;
  const level = LEVEL_NAMES[entry.level] ?? "UNKNOWN";
  const name = entry.name;
  let line = `[${timestamp}] ${level} [${name}] ${entry.message}`;
  if (entry.context && Object.keys(entry.context).length > 0) {
    line += ` ${JSON.stringify(entry.context)}`;
  }
  if (entry.error) {
    line += ` error=${entry.error.message}`;
    if (entry.error.stack) {
      line += `\n${entry.error.stack}`;
    }
  }
  return line;
}

export function createLogger(name: string, options?: LoggerOptions): Logger {
  return new Logger(name, options);
}

export async function rotateLogFiles(dir: string, maxFiles: number): Promise<void> {
  if (maxFiles < 1) {
    return;
  }
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return;
  }
  const logFiles: { name: string; mtime: number }[] = [];
  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const stats = await stat(filePath);
      if (stats.isFile()) {
        logFiles.push({ name: file, mtime: stats.mtimeMs });
      }
    } catch {
      continue;
    }
  }
  logFiles.sort((a, b) => a.mtime - b.mtime);
  while (logFiles.length > maxFiles) {
    const oldest = logFiles.shift();
    if (oldest) {
      try {
        await unlink(join(dir, oldest.name));
      } catch {
        break;
      }
    }
  }
}
