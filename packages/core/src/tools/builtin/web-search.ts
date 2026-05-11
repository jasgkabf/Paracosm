import type { ToolResult } from '@paracosm/shared';
import { TOOL_WEB_SEARCH, DEFAULT_TOOL_CONFIG } from '@paracosm/shared';
import type { ToolDefinition, ToolExecutionContext } from '../types.js';

export class WebSearchTool {
  static readonly definition: ToolDefinition = {
    id: TOOL_WEB_SEARCH,
    name: 'Web Search',
    type: 'search',
    description: 'Search the web for information',
    version: '1.0.0',
    config: { ...DEFAULT_TOOL_CONFIG },
    permissions: [{ resource: 'web', actions: ['read'], constraints: {} }],
    handler: async (input: unknown, context: ToolExecutionContext): Promise<ToolResult> => {
      const query = (input as { query?: string })?.query ?? '';
      const maxResults = (input as { maxResults?: number })?.maxResults ?? 10;
      return {
        toolId: TOOL_WEB_SEARCH,
        success: true,
        output: {
          query,
          results: [],
          totalResults: 0,
          message: `Web search for "${query}" completed (mock)`,
        },
        duration: 100,
        metadata: {},
        timestamp: new Date(),
      };
    },
    validate: (input: unknown): string[] => {
      const errors: string[] = [];
      if (!input || typeof input !== 'object') { errors.push('Input must be an object'); return errors; }
      const data = input as Record<string, unknown>;
      if (!data.query || typeof data.query !== 'string') errors.push('query is required and must be a string');
      return errors;
    },
  };
}
