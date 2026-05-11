import { exec, spawn } from "node:child_process";
import type { ToolInternal, ToolExecutionContext, ToolExecutionResult } from "../types.js";
import { ToolType, ToolError, generateId } from "@paracosm/shared";

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  timedOut: boolean;
  command: string;
}

export interface ProcessHandle {
  pid: number;
  command: string;
  startTime: string;
  close(): void;
}

export interface ShellOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  shell?: string;
  maxBuffer?: number;
}

const BLOCKED_COMMANDS: ReadonlySet<string> = new Set([
  "rm -rf /",
  "mkfs",
  "dd if=/dev/zero",
  ":(){ :|:& };:",
  "format c:",
  "del /f /s /q c:\\",
]);

const DANGEROUS_PATTERNS: ReadonlyArray<RegExp> = [
  /rm\s+(-rf?|-fr?)\s+\//,
  /dd\s+if=/,
  /mkfs\./,
  />\s*\/dev\/sd/,
  /chmod\s+000\s+\//,
  /chown\s+.*\s+\//,
];

export class ShellExecutorTool implements ToolInternal {
  id = "shell_exec";
  name = "Shell Executor";
  type = ToolType.Shell;
  description = "Execute shell commands with safety checks, piping, redirection, and background process support";
  parameters = [
    { name: "command", type: "string" as const, description: "Shell command to execute", required: true, defaultValue: null, enum: null },
    { name: "cwd", type: "string" as const, description: "Working directory", required: false, defaultValue: null, enum: null },
    { name: "timeout", type: "number" as const, description: "Execution timeout in milliseconds", required: false, defaultValue: 30000, enum: null },
  ];
  returnType = "ShellResult";
  returnDescription = "Shell execution result with stdout, stderr, and exit code";
  version = "1.0.0";
  deprecated = false;
  deprecationMessage = null;
  examples = [
    { input: { command: "echo hello" }, output: { stdout: "hello\n", stderr: "", exitCode: 0 }, description: "Execute a simple echo command" },
  ];
  createdAt = new Date().toISOString();
  updatedAt = new Date().toISOString();
  dependencies: string[] = [];
  category = "system";
  permissionLevel = "dangerous" as const;
  rateLimitPerMinute = 30;
  maxConcurrentExecutions = 5;
  requiresSandbox = true;

  private allowedCommands: Set<string> | null = null;
  private deniedCommands: Set<string> = new Set(BLOCKED_COMMANDS);
  private defaultTimeout: number = 30000;
  private maxOutputSize: number = 1024 * 1024;
  private activeProcesses: Map<number, ProcessHandle> = new Map();

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    try {
      const command = String(params.command ?? "");
      if (!command.trim()) {
        return this.errorResult("Command must be a non-empty string", startTime);
      }
      if (!this.isCommandAllowed(command)) {
        return this.errorResult(`Command blocked for safety: ${command}`, startTime);
      }
      const options: ShellOptions = {
        cwd: params.cwd ? String(params.cwd) : undefined,
        env: params.env as Record<string, string> | undefined,
        timeout: Number(params.timeout ?? this.defaultTimeout),
        maxBuffer: this.maxOutputSize,
      };
      const result = await this.executeCommand(command, options);
      return this.successResult(result, startTime);
    } catch (error) {
      return this.errorResult(
        error instanceof Error ? error.message : String(error),
        startTime
      );
    }
  }

  validate(params: Record<string, unknown>): boolean {
    if (!params.command || typeof params.command !== "string" || params.command.trim().length === 0) return false;
    if (params.timeout !== undefined && (typeof params.timeout !== "number" || params.timeout < 0)) return false;
    if (params.cwd !== undefined && typeof params.cwd !== "string") return false;
    return true;
  }

  async executeCommand(command: string, options?: ShellOptions): Promise<ShellResult> {
    if (!this.isCommandAllowed(command)) {
      throw new ToolError(`Command blocked for safety: ${command}`, { command });
    }
    const startTime = Date.now();
    const timeout = options?.timeout ?? this.defaultTimeout;
    const maxBuffer = options?.maxBuffer ?? this.maxOutputSize;

    return new Promise<ShellResult>((resolve) => {
      const execOptions: Record<string, unknown> = {
        timeout,
        maxBuffer,
        cwd: options?.cwd,
        env: options?.env ? { ...process.env, ...options.env } : process.env,
      };

      exec(command, execOptions, (error, stdout, stderr) => {
        const executionTimeMs = Date.now() - startTime;
        const truncatedStdout = stdout.length > this.maxOutputSize
          ? stdout.slice(0, this.maxOutputSize) + "\n... [output truncated]"
          : stdout;
        const truncatedStderr = stderr.length > this.maxOutputSize
          ? stderr.slice(0, this.maxOutputSize) + "\n... [output truncated]"
          : stderr;

        resolve({
          stdout: truncatedStdout,
          stderr: truncatedStderr,
          exitCode: error ? (error as any).code ?? 1 : 0,
          executionTimeMs,
          timedOut: error ? error.message.includes("ETIMEDOUT") || error.message.includes("timed out") || (error as any).killed === true : false,
          command,
        });
      });
    });
  }

  async pipe(commands: string[]): Promise<ShellResult> {
    if (!commands || commands.length === 0) {
      throw new ToolError("At least one command is required for pipe", {});
    }
    for (const cmd of commands) {
      if (!this.isCommandAllowed(cmd)) {
        throw new ToolError(`Command blocked for safety: ${cmd}`, { command: cmd });
      }
    }
    const pipedCommand = commands.join(" | ");
    return this.executeCommand(pipedCommand);
  }

  async redirect(command: string, outputFile: string): Promise<ShellResult> {
    if (!this.isCommandAllowed(command)) {
      throw new ToolError(`Command blocked for safety: ${command}`, { command });
    }
    const redirectedCommand = `${command} > ${outputFile}`;
    return this.executeCommand(redirectedCommand);
  }

  background(command: string, options?: ShellOptions): ProcessHandle {
    if (!this.isCommandAllowed(command)) {
      throw new ToolError(`Command blocked for safety: ${command}`, { command });
    }
    const parts = command.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);
    const child = spawn(cmd, args, {
      cwd: options?.cwd,
      env: options?.env ? { ...process.env, ...options.env } : process.env,
      detached: true,
      stdio: "ignore",
    });
    const handle: ProcessHandle = {
      pid: child.pid ?? -1,
      command,
      startTime: new Date().toISOString(),
      close() {
        try {
          if (child.pid) {
            process.kill(child.pid, "SIGTERM");
          }
        } catch {
          // process may have already exited
        }
      },
    };
    if (child.pid) {
      this.activeProcesses.set(child.pid, handle);
    }
    child.unref();
    return handle;
  }

  setAllowedCommands(commands: string[] | null): void {
    if (commands === null) {
      this.allowedCommands = null;
    } else {
      this.allowedCommands = new Set(commands);
    }
  }

  addDeniedCommand(command: string): void {
    this.deniedCommands.add(command);
  }

  setDefaultTimeout(ms: number): void {
    this.defaultTimeout = ms;
  }

  getActiveProcesses(): ProcessHandle[] {
    return Array.from(this.activeProcesses.values());
  }

  killProcess(pid: number): boolean {
    const handle = this.activeProcesses.get(pid);
    if (handle) {
      handle.close();
      this.activeProcesses.delete(pid);
      return true;
    }
    return false;
  }

  private isCommandAllowed(command: string): boolean {
    const trimmed = command.trim();
    for (const blocked of this.deniedCommands) {
      if (trimmed.includes(blocked)) {
        return false;
      }
    }
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(trimmed)) {
        return false;
      }
    }
    if (this.allowedCommands !== null) {
      const cmdBase = trimmed.split(/\s+/)[0];
      if (!this.allowedCommands.has(cmdBase)) {
        return false;
      }
    }
    return true;
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
