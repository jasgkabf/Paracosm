import type { ToolResult } from '@paracosm/shared';
import { TOOL_FILE_OPERATIONS, DEFAULT_TOOL_CONFIG } from '@paracosm/shared';
import type { ToolDefinition, ToolExecutionContext } from '../types.js';

export class FileOperationsTool {
  static readonly definition: ToolDefinition = {
    id: TOOL_FILE_OPERATIONS,
    name: 'File Operations',
    type: 'file_operation',
    description: 'Read, write, and manage files',
    version: '1.0.0',
    config: { ...DEFAULT_TOOL_CONFIG },
    permissions: [
      { resource: 'filesystem', actions: ['read', 'write'], constraints: { sandboxed: true } },
    ],
    handler: async (input: unknown, context: ToolExecutionContext): Promise<ToolResult> => {
      const data = input as { operation?: string; path?: string; content?: string };
      const operation = data.operation ?? 'read';
      const path = data.path ?? '';
      return {
        toolId: TOOL_FILE_OPERATIONS,
        success: true,
        output: { operation, path, message: `File ${operation} on ${path} completed (mock)` },
        duration: 50,
        metadata: {},
        timestamp: new Date(),
      };
    },
    validate: (input: unknown): string[] => {
      const errors: string[] = [];
      if (!input || typeof input !== 'object') { errors.push('Input must be an object'); return errors; }
      const data = input as Record<string, unknown>;
      if (!data.operation) errors.push('operation is required');
      if (!data.path) errors.push('path is required');
      return errors;
    },
  };
}
