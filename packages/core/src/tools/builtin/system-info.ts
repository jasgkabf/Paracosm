import type { ToolResult } from '@paracosm/shared';
import { TOOL_SYSTEM_INFO, DEFAULT_TOOL_CONFIG } from '@paracosm/shared';
import type { ToolDefinition, ToolExecutionContext } from '../types.js';

export class SystemInfoTool {
  static readonly definition: ToolDefinition = {
    id: TOOL_SYSTEM_INFO,
    name: 'System Info',
    type: 'computation',
    description: 'Get system information and metrics',
    version: '1.0.0',
    config: { ...DEFAULT_TOOL_CONFIG },
    permissions: [{ resource: 'system', actions: ['read'], constraints: {} }],
    handler: async (input: unknown, context: ToolExecutionContext): Promise<ToolResult> => {
      const data = input as { infoType?: string };
      const infoType = data.infoType ?? 'general';
      const info: Record<string, unknown> = {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        cpuCount: 1,
        totalMemoryMB: 512,
        freeMemoryMB: 256,
        uptimeSeconds: process.uptime(),
      };
      return {
        toolId: TOOL_SYSTEM_INFO,
        success: true,
        output: { infoType, info, message: `System info retrieved (mock)` },
        duration: 10,
        metadata: {},
        timestamp: new Date(),
      };
    },
    validate: (input: unknown): string[] => {
      return [];
    },
  };
}
