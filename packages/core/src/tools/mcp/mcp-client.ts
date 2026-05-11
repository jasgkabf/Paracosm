import type { MCPConfig, ToolResult } from '@paracosm/shared';
import { ok, err, type Result, createLogger } from '@paracosm/shared';
import { MCP_DEFAULTS } from '@paracosm/shared';

const logger = createLogger('MCPClient');

export class MCPClient {
  private configs: Map<string, MCPConfig> = new Map();
  private connections: Map<string, { connected: boolean; lastActivity: Date }> = new Map();

  async connect(config: MCPConfig): Promise<Result<boolean>> {
    const fullConfig: MCPConfig = { ...MCP_DEFAULTS, ...config };
    this.configs.set(config.serverName, fullConfig);
    this.connections.set(config.serverName, { connected: true, lastActivity: new Date() });
    logger.info(`Connected to MCP server: ${config.serverName}`);
    return ok(true);
  }

  async disconnect(serverName: string): Promise<Result<boolean>> {
    const connection = this.connections.get(serverName);
    if (!connection) {
      return err(new Error(`Not connected to server: ${serverName}`));
    }
    connection.connected = false;
    logger.info(`Disconnected from MCP server: ${serverName}`);
    return ok(true);
  }

  async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<Result<ToolResult>> {
    const connection = this.connections.get(serverName);
    if (!connection || !connection.connected) {
      return err(new Error(`Not connected to server: ${serverName}`));
    }
    connection.lastActivity = new Date();
    return ok({
      toolId: toolName,
      success: true,
      output: { toolName, args, message: `MCP tool call completed (mock)` },
      duration: 100,
      metadata: { serverName },
      timestamp: new Date(),
    });
  }

  isConnected(serverName: string): boolean {
    const connection = this.connections.get(serverName);
    return connection?.connected ?? false;
  }

  getConnectedServers(): string[] {
    return Array.from(this.connections.entries())
      .filter(([, conn]) => conn.connected)
      .map(([name]) => name);
  }

  getConfig(serverName: string): MCPConfig | undefined {
    return this.configs.get(serverName);
  }

  clear(): void {
    this.configs.clear();
    this.connections.clear();
  }
}
