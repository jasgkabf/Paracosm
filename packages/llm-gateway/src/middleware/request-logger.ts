import { EventEmitter } from "node:events";
import { mkdir, readdir, unlink, stat, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { createWriteStream } from "node:fs";
import { Logger } from "@paracosm/shared";

const logger = new Logger("RequestLogger");

export interface LogRecord {
  id: string;
  requestId: string;
  providerId: string;
  modelId: string;
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  error: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface LogQuery {
  startTime?: string;
  endTime?: string;
  providerId?: string;
  modelId?: string;
  statusCode?: number;
  minLatencyMs?: number;
  maxLatencyMs?: number;
  limit?: number;
  offset?: number;
}

const SENSITIVE_FIELDS = ["apiKey", "api_key", "authorization", "token", "secret", "password", "credential"];

export class RequestLogger extends EventEmitter {
  private logDir: string;
  private maxFileSize: number = 50 * 1024 * 1024;
  private maxFiles: number = 10;
  private currentFile: string = "";
  private records: LogRecord[] = [];
  private maxRecords: number = 10000;

  constructor(logDir: string) {
    super();
    this.logDir = logDir;
    this.currentFile = join(logDir, `requests_${new Date().toISOString().split("T")[0]}.log`);
  }

  async log(record: Omit<LogRecord, "id" | "timestamp">): Promise<void> {
    const fullRecord: LogRecord = {
      ...record,
      id: this.generateLogId(),
      timestamp: new Date().toISOString(),
    };

    this.records.push(fullRecord);
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }

    this.emit("logged", fullRecord);

    try {
      await mkdir(this.logDir, { recursive: true });
      const line = JSON.stringify(fullRecord) + "\n";
      await appendFile(this.currentFile, line, "utf-8");
    } catch (error) {
      logger.warn(`Failed to write log: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  audit(record: Omit<LogRecord, "id" | "timestamp">): LogRecord {
    const fullRecord: LogRecord = {
      ...record,
      id: this.generateLogId(),
      timestamp: new Date().toISOString(),
    };
    this.emit("audit", fullRecord);
    return fullRecord;
  }

  sanitize(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitize(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  async rotate(): Promise<void> {
    try {
      const files = await readdir(this.logDir);
      const logFiles: { name: string; mtime: number }[] = [];

      for (const file of files) {
        const filePath = join(this.logDir, file);
        const stats = await stat(filePath);
        if (stats.isFile() && file.endsWith(".log")) {
          logFiles.push({ name: file, mtime: stats.mtimeMs });
        }
      }

      logFiles.sort((a, b) => a.mtime - b.mtime);

      while (logFiles.length > this.maxFiles) {
        const oldest = logFiles.shift();
        if (oldest) {
          await unlink(join(this.logDir, oldest.name));
        }
      }

      this.currentFile = join(this.logDir, `requests_${new Date().toISOString().split("T")[0]}.log`);
    } catch {
      // directory may not exist yet
    }
  }

  query(query: LogQuery): LogRecord[] {
    let results = [...this.records];

    if (query.startTime) {
      const start = new Date(query.startTime).getTime();
      results = results.filter((r) => new Date(r.timestamp).getTime() >= start);
    }
    if (query.endTime) {
      const end = new Date(query.endTime).getTime();
      results = results.filter((r) => new Date(r.timestamp).getTime() <= end);
    }
    if (query.providerId) {
      results = results.filter((r) => r.providerId === query.providerId);
    }
    if (query.modelId) {
      results = results.filter((r) => r.modelId === query.modelId);
    }
    if (query.statusCode) {
      results = results.filter((r) => r.statusCode === query.statusCode);
    }
    if (query.minLatencyMs !== undefined) {
      results = results.filter((r) => r.latencyMs >= query.minLatencyMs!);
    }
    if (query.maxLatencyMs !== undefined) {
      results = results.filter((r) => r.latencyMs <= query.maxLatencyMs!);
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}
