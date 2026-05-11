import type { MCPConfig, Tool, ToolId } from '@paracosm/shared';
import { MCPClient } from './mcp-client.js';
import { MCPTransport } from './mcp-transport.js';
import { ToolRegistry } from '../tool-registry.js';
import { ok, err, type Result, createLogger } from '@paracosm/shared';

const logger = createLogger('MCPAdapter');

export class MCPAdapter {
  private client: MCPClient;
  private transport: MCPTransport;
  private registry: ToolRegistry;
  private toolServerMap: Map<ToolId, string> = new Map();

  constructor(registry: ToolRegistry) {
    this.client = new MCPClient();
    this.transport = new MCPTransport();
    this.registry = registry;
  }

  async registerServer(config: MCPConfig): Promise<Result<boolean>> {
    const connectResult = await this.client.connect(config);
    if (!connectResult.ok) return connectResult;
    await this.transport.connect(config);
    for (const toolId of config.tools) {
      this.toolServerMap.set(toolId, config.serverName);
      this.registry.register({
        id: toolId,
        name: `MCP Tool: ${toolId}`,
        type: 'mcp',
        description: `Remote tool from ${config.serverName}`,
        version: '1.0.0',
        config: { timeout: 30000, retries: 2, maxConcurrentCalls: 5, rateLimitPerMinute: 60, cacheResults: false, cacheTtlMs: 0, parameters: {}, environment: {} },
        permissions: [{ resource: 'mcp', actions: ['read', 'execute'], constraints: { server: config.serverName } }],
        handler: async (input: unknown) => {
          const result = await this.client.callTool(config.serverName, toolId, input as Record<string, unknown>);
          if (!result.ok) {
            return { toolId, success: false, output: null, error: result.err.message, duration: 0, metadata: {}, timestamp: new Date() };
          }
          return result.value;
        },
      });
    }
    logger.info(`Registered MCP server: ${config.serverName} with ${config.tools.length} tools`);
    return ok(true);
  }

  async unregisterServer(serverName: string): Promise<Result<boolean>> {
    for (const [toolId, server] of this.toolServerMap) {
      if (server === serverName) {
        this.registry.unregister(toolId);
        this.toolServerMap.delete(toolId);
      }
    }
    await this.client.disconnect(serverName);
    return ok(true);
  }

  getRegisteredServers(): string[] {
    return [...new Set(this.toolServerMap.values())];
  }

  clear(): void {
    this.client.clear();
    this.toolServerMap.clear();
  }
}
