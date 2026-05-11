import type { ToolResult } from '@paracosm/shared';
import { TOOL_CODE_EXECUTOR, DEFAULT_TOOL_CONFIG } from '@paracosm/shared';
import type { ToolDefinition, ToolExecutionContext } from '../types.js';

export class CodeExecutorTool {
  static readonly definition: ToolDefinition = {
    id: TOOL_CODE_EXECUTOR,
    name: 'Code Executor',
    type: 'code_execution',
    description: 'Execute code in a sandboxed environment',
    version: '1.0.0',
    config: { ...DEFAULT_TOOL_CONFIG, timeout: 60000 },
    permissions: [
      { resource: 'code', actions: ['execute'], constraints: { sandboxed: true } },
    ],
    handler: async (input: unknown, context: ToolExecutionContext): Promise<ToolResult> => {
      const data = input as { code?: string; language?: string };
      const code = data.code ?? '';
      const language = data.language ?? 'javascript';
      return {
        toolId: TOOL_CODE_EXECUTOR,
        success: true,
        output: { code, language, stdout: '', stderr: '', exitCode: 0, message: `Code execution completed (mock)` },
        duration: 200,
        metadata: {},
        timestamp: new Date(),
      };
    },
    validate: (input: unknown): string[] => {
      const errors: string[] = [];
      if (!input || typeof input !== 'object') { errors.push('Input must be an object'); return errors; }
      const data = input as Record<string, unknown>;
      if (!data.code || typeof data.code !== 'string') errors.push('code is required and must be a string');
      return errors;
    },
  };
}
