import type { ToolResult } from '@paracosm/shared';
import { TOOL_API_CALLER, DEFAULT_TOOL_CONFIG } from '@paracosm/shared';
import type { ToolDefinition, ToolExecutionContext } from '../types.js';

export class ApiCallerTool {
  static readonly definition: ToolDefinition = {
    id: TOOL_API_CALLER,
    name: 'API Caller',
    type: 'api_call',
    description: 'Make HTTP API calls',
    version: '1.0.0',
    config: { ...DEFAULT_TOOL_CONFIG, timeout: 30000 },
    permissions: [
      { resource: 'network', actions: ['read', 'write'], constraints: {} },
    ],
    handler: async (input: unknown, context: ToolExecutionContext): Promise<ToolResult> => {
      const data = input as { url?: string; method?: string; headers?: Record<string, string>; body?: unknown };
      return {
        toolId: TOOL_API_CALLER,
        success: true,
        output: {
          url: data.url ?? '',
          method: data.method ?? 'GET',
          statusCode: 200,
          body: null,
          message: `API call to ${data.url ?? 'unknown'} completed (mock)`,
        },
        duration: 150,
        metadata: {},
        timestamp: new Date(),
      };
    },
    validate: (input: unknown): string[] => {
      const errors: string[] = [];
      if (!input || typeof input !== 'object') { errors.push('Input must be an object'); return errors; }
      const data = input as Record<string, unknown>;
      if (!data.url || typeof data.url !== 'string') errors.push('url is required');
      return errors;
    },
  };
}
