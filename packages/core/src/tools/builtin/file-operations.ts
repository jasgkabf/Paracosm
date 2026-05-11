import { readFile, writeFile, mkdir, rename, copyFile, unlink, readdir, stat, watch } from "node:fs/promises";
import { existsSync, watch as watchSync, createReadStream, createWriteStream } from "node:fs";
import { join, relative, dirname, basename, extname } from "node:path";
import type {
  ToolInternal,
  ToolExecutionContext,
  ToolExecutionResult,
} from "../types.js";
import { ToolType, ToolError, generateId } from "@paracosm/shared";

export interface ReadOptions {
  encoding?: BufferEncoding;
  offset?: number;
  limit?: number;
}

export interface WatchHandle {
  close(): void;
}

export class FileOperationsTool implements ToolInternal {
  id = "file_ops";
  name = "File Operations";
  type = ToolType.FileOperation;
  description = "Read, write, search, move, copy, delete, watch, and diff files with safety checks";
  parameters = [
    { name: "operation", type: "string" as const, description: "File operation to perform", required: true, defaultValue: null, enum: ["read", "write", "search", "move", "copy", "delete", "watch", "diff"] },
    { name: "path", type: "string" as const, description: "File or directory path", required: true, defaultValue: null, enum: null },
    { name: "content", type: "string" as const, description: "Content for write operations", required: false, defaultValue: null, enum: null },
    { name: "pattern", type: "string" as const, description: "Search pattern for file search", required: false, defaultValue: null, enum: null },
  ];
  returnType = "unknown";
  returnDescription = "Result depends on the operation performed";
  version = "1.0.0";
  deprecated = false;
  deprecationMessage = null;
  examples = [
    { input: { operation: "read", path: "/tmp/test.txt" }, output: "file contents", description: "Read a file" },
  ];
  createdAt = new Date().toISOString();
  updatedAt = new Date().toISOString();
  dependencies: string[] = [];
  category = "file";
  permissionLevel = "caution" as const;
  rateLimitPerMinute = 60;
  maxConcurrentExecutions = 10;
  requiresSandbox = false;

  private allowedPaths: Set<string> = new Set();
  private deniedPaths: Set<string> = new Set();
  private maxFileSize: number = 50 * 1024 * 1024;

  constructor(allowedPaths?: string[], deniedPaths?: string[]) {
    if (allowedPaths) {
      for (const p of allowedPaths) this.allowedPaths.add(p);
    }
    if (deniedPaths) {
      for (const p of deniedPaths) this.deniedPaths.add(p);
    }
  }

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    try {
      const operation = String(params.operation ?? "");
      const path = String(params.path ?? "");
      if (!operation) {
        return this.errorResult("Operation is required", startTime);
      }
      if (!path) {
        return this.errorResult("Path is required", startTime);
      }
      if (!this.isPathAllowed(path)) {
        return this.errorResult(`Access denied for path: ${path}`, startTime);
      }
      switch (operation) {
        case "read": {
          const options: ReadOptions = {};
          if (params.encoding) options.encoding = String(params.encoding) as BufferEncoding;
          if (params.offset) options.offset = Number(params.offset);
          if (params.limit) options.limit = Number(params.limit);
          const content = await this.read(path, options);
          return this.successResult(content, startTime);
        }
        case "write": {
          const content = String(params.content ?? "");
          await this.write(path, content);
          return this.successResult({ written: true, path, bytes: Buffer.byteLength(content, "utf-8") }, startTime);
        }
        case "search": {
          const pattern = String(params.pattern ?? "*");
          const results = await this.search(path, pattern);
          return this.successResult(results, startTime);
        }
        case "move": {
          const dest = String(params.destination ?? "");
          if (!dest) return this.errorResult("Destination path is required for move", startTime);
          await this.move(path, dest);
          return this.successResult({ moved: true, from: path, to: dest }, startTime);
        }
        case "copy": {
          const dest = String(params.destination ?? "");
          if (!dest) return this.errorResult("Destination path is required for copy", startTime);
          await this.copy(path, dest);
          return this.successResult({ copied: true, from: path, to: dest }, startTime);
        }
        case "delete": {
          await this.delete(path);
          return this.successResult({ deleted: true, path }, startTime);
        }
        case "watch": {
          const handler = params.handler as ((event: string, filename: string) => void) | undefined;
          const handle = this.watch(path, handler);
          return this.successResult({ watching: true, path, handleId: generateId() }, startTime);
        }
        case "diff": {
          const path2 = String(params.path2 ?? "");
          if (!path2) return this.errorResult("Second path is required for diff", startTime);
          const diffResult = await this.diff(path, path2);
          return this.successResult(diffResult, startTime);
        }
        default:
          return this.errorResult(`Unknown operation: ${operation}`, startTime);
      }
    } catch (error) {
      return this.errorResult(
        error instanceof Error ? error.message : String(error),
        startTime
      );
    }
  }

  validate(params: Record<string, unknown>): boolean {
    if (!params.operation || typeof params.operation !== "string") return false;
    const validOps = ["read", "write", "search", "move", "copy", "delete", "watch", "diff"];
    if (!validOps.includes(params.operation as string)) return false;
    if (!params.path || typeof params.path !== "string") return false;
    if (params.operation === "write" && (params.content === undefined || params.content === null)) return false;
    if (params.operation === "search" && (!params.pattern || typeof params.pattern !== "string")) return false;
    return true;
  }

  async read(path: string, options?: ReadOptions): Promise<string> {
    this.validatePath(path);
    if (!existsSync(path)) {
      throw new ToolError(`File not found: ${path}`, { path });
    }
    const fileStat = await stat(path);
    if (fileStat.size > this.maxFileSize) {
      throw new ToolError(`File exceeds maximum size: ${fileStat.size} bytes > ${this.maxFileSize} bytes`, {
        path,
        size: fileStat.size,
        maxSize: this.maxFileSize,
      });
    }
    const encoding = options?.encoding ?? "utf-8";
    let content: string;
    if (options?.offset !== undefined || options?.limit !== undefined) {
      const buffer = await readFile(path);
      const offset = options?.offset ?? 0;
      const limit = options?.limit ?? buffer.length;
      content = buffer.slice(offset, offset + limit).toString(encoding);
    } else {
      content = await readFile(path, { encoding: encoding as BufferEncoding });
    }
    return content;
  }

  async write(path: string, content: string): Promise<void> {
    this.validatePath(path);
    const dir = dirname(path);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(path, content, { encoding: "utf-8" });
  }

  async search(dir: string, pattern: string): Promise<string[]> {
    this.validatePath(dir);
    if (!existsSync(dir)) {
      throw new ToolError(`Directory not found: ${dir}`, { dir });
    }
    const results: string[] = [];
    const regex = this.patternToRegex(pattern);
    await this.searchRecursive(dir, regex, results);
    return results;
  }

  async move(source: string, dest: string): Promise<void> {
    this.validatePath(source);
    this.validatePath(dest);
    if (!existsSync(source)) {
      throw new ToolError(`Source not found: ${source}`, { source });
    }
    const destDir = dirname(dest);
    if (!existsSync(destDir)) {
      await mkdir(destDir, { recursive: true });
    }
    await rename(source, dest);
  }

  async copy(source: string, dest: string): Promise<void> {
    this.validatePath(source);
    this.validatePath(dest);
    if (!existsSync(source)) {
      throw new ToolError(`Source not found: ${source}`, { source });
    }
    const destDir = dirname(dest);
    if (!existsSync(destDir)) {
      await mkdir(destDir, { recursive: true });
    }
    const sourceStat = await stat(source);
    if (sourceStat.isDirectory()) {
      await this.copyDirectory(source, dest);
    } else {
      await copyFile(source, dest);
    }
  }

  async delete(path: string): Promise<void> {
    this.validatePath(path);
    if (!existsSync(path)) {
      throw new ToolError(`Path not found: ${path}`, { path });
    }
    await unlink(path);
  }

  watch(path: string, handler?: (event: string, filename: string) => void): WatchHandle {
    this.validatePath(path);
    if (!existsSync(path)) {
      throw new ToolError(`Path not found: ${path}`, { path });
    }
    const watcher = watchSync(path, { recursive: true }, (event, filename) => {
      if (handler) {
        handler(event, filename ?? "");
      }
    });
    return {
      close() {
        watcher.close();
      },
    };
  }

  async diff(path1: string, path2: string): Promise<string> {
    this.validatePath(path1);
    this.validatePath(path2);
    if (!existsSync(path1)) {
      throw new ToolError(`File not found: ${path1}`, { path: path1 });
    }
    if (!existsSync(path2)) {
      throw new ToolError(`File not found: ${path2}`, { path: path2 });
    }
    const content1 = await readFile(path1, "utf-8");
    const content2 = await readFile(path2, "utf-8");
    const lines1 = content1.split("\n");
    const lines2 = content2.split("\n");
    const maxLines = Math.max(lines1.length, lines2.length);
    const diffLines: string[] = [];
    for (let i = 0; i < maxLines; i++) {
      const line1 = i < lines1.length ? lines1[i] : undefined;
      const line2 = i < lines2.length ? lines2[i] : undefined;
      if (line1 !== line2) {
        if (line1 !== undefined) {
          diffLines.push(`- ${i + 1}: ${line1}`);
        }
        if (line2 !== undefined) {
          diffLines.push(`+ ${i + 1}: ${line2}`);
        }
      }
    }
    if (diffLines.length === 0) {
      return "Files are identical";
    }
    return `--- ${path1}\n+++ ${path2}\n${diffLines.join("\n")}`;
  }

  setMaxFileSize(bytes: number): void {
    this.maxFileSize = bytes;
  }

  addAllowedPath(path: string): void {
    this.allowedPaths.add(path);
  }

  addDeniedPath(path: string): void {
    this.deniedPaths.add(path);
  }

  private isPathAllowed(path: string): boolean {
    const resolved = path;
    for (const denied of this.deniedPaths) {
      if (resolved.startsWith(denied)) {
        return false;
      }
    }
    if (this.allowedPaths.size > 0) {
      let isAllowed = false;
      for (const allowed of this.allowedPaths) {
        if (resolved.startsWith(allowed)) {
          isAllowed = true;
          break;
        }
      }
      return isAllowed;
    }
    return true;
  }

  private validatePath(path: string): void {
    if (!path || path.trim().length === 0) {
      throw new ToolError("Path must be a non-empty string", { path });
    }
    if (path.includes("..")) {
      throw new ToolError("Path traversal detected: path must not contain '..'", { path });
    }
  }

  private patternToRegex(pattern: string): RegExp {
    let regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    return new RegExp(`^${regexStr}$`, "i");
  }

  private async searchRecursive(dir: string, regex: RegExp, results: string[]): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.searchRecursive(fullPath, regex, results);
      } else if (entry.isFile()) {
        if (regex.test(entry.name)) {
          results.push(fullPath);
        }
      }
    }
  }

  private async copyDirectory(source: string, dest: string): Promise<void> {
    await mkdir(dest, { recursive: true });
    const entries = await readdir(source, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = join(source, entry.name);
      const destPath = join(dest, entry.name);
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }
  }

  private successResult(data: unknown, startTime: number): ToolExecutionResult {
    return {
      executionId: generateId(),
      toolId: this.id,
      success: true,
      data,
      error: null,
      executionTimeMs: Date.now() - startTime,
      memoryUsedBytes: 0,
      cpuTimeMs: Date.now() - startTime,
      retries: 0,
      timestamp: new Date().toISOString(),
    };
  }

  private errorResult(error: string, startTime: number): ToolExecutionResult {
    return {
      executionId: generateId(),
      toolId: this.id,
      success: false,
      data: null,
      error,
      executionTimeMs: Date.now() - startTime,
      memoryUsedBytes: 0,
      cpuTimeMs: Date.now() - startTime,
      retries: 0,
      timestamp: new Date().toISOString(),
    };
  }
}
