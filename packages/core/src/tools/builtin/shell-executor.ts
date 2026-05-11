import type { ToolResult } from '@paracosm/shared';
import { TOOL_SHELL_EXECUTOR, DEFAULT_TOOL_CONFIG } from '@paracosm/shared';
import type { ToolDefinition, ToolExecutionContext } from '../types.js';

export class ShellExecutorTool {
  static readonly definition: ToolDefinition = {
    id: TOOL_SHELL_EXECUTOR,
    name: 'Shell Executor',
    type: 'code_execution',
    description: 'Execute shell commands in a sandboxed environment',
    version: '1.0.0',
    config: { ...DEFAULT_TOOL_CONFIG, timeout: 30000 },
    permissions: [
      { resource: 'shell', actions: ['execute'], constraints: { sandboxed: true } },
    ],
    handler: async (input: unknown, context: ToolExecutionContext): Promise<ToolResult> => {
      const data = input as { command?: string; args?: string[] };
      const command = data.command ?? '';
      return {
        toolId: TOOL_SHELL_EXECUTOR,
        success: true,
        output: { command, stdout: '', stderr: '', exitCode: 0, message: `Shell command executed (mock)` },
        duration: 100,
        metadata: {},
        timestamp: new Date(),
      };
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
