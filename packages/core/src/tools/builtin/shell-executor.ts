import { exec } from 'node:child_process';
import type { ToolResult } from '@paracosm/shared';
import { TOOL_SHELL_EXECUTOR, DEFAULT_TOOL_CONFIG } from '@paracosm/shared';
import type { ToolDefinition, ToolExecutionContext } from '../types.js';

export class ShellExecutorTool {
  static readonly definition: ToolDefinition = {
    id: TOOL_SHELL_EXECUTOR,
    name: 'Shell Executor',
    type: 'code_execution',
    description: 'Execute shell commands and return stdout, stderr, and exit code',
    version: '1.0.0',
    config: { ...DEFAULT_TOOL_CONFIG, timeout: 30000 },
    permissions: [
      { resource: 'shell', actions: ['execute'], constraints: { sandboxed: true } },
    ],
    handler: async (input: unknown, _context: ToolExecutionContext): Promise<ToolResult> => {
      const startTime = Date.now();
      const data = input as { command?: string; timeout?: number };
      const command = data.command ?? '';
      const timeout = data.timeout ?? 30000;

      if (!command) {
        return {
          toolId: TOOL_SHELL_EXECUTOR,
          success: false,
          output: null,
          error: 'No command provided',
          duration: Date.now() - startTime,
          metadata: {},
          timestamp: new Date(),
        };
      }

      return new Promise((resolve) => {
        exec(command, { timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
          const duration = Date.now() - startTime;
          const exitCode = error ? (error as NodeJS.ErrnoException & { code?: number }).code ?? 1 : 0;

          if (error && error.killed) {
            resolve({
              toolId: TOOL_SHELL_EXECUTOR,
              success: false,
              output: {
                command,
                stdout: stdout.toString(),
                stderr: stderr.toString(),
                exitCode: -1,
                timedOut: true,
              },
              error: `Command timed out after ${timeout}ms`,
              duration,
              metadata: {},
              timestamp: new Date(),
            });
            return;
          }

          resolve({
            toolId: TOOL_SHELL_EXECUTOR,
            success: exitCode === 0,
            output: {
              command,
              stdout: stdout.toString(),
              stderr: stderr.toString(),
              exitCode: typeof exitCode === 'number' ? exitCode : 1,
            },
            duration,
            metadata: {},
            timestamp: new Date(),
          });
        });
      });
    },
    validate: (input: unknown): string[] => {
      const errors: string[] = [];
      if (!input || typeof input !== 'object') { errors.push('Input must be an object'); return errors; }
      const data = input as Record<string, unknown>;
      if (!data.command || typeof data.command !== 'string') errors.push('command is required');
      return errors;
    },
  };
}
