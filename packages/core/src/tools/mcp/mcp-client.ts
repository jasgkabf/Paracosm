import type { MCPServerConfig } from "@paracosm/shared";
import { ToolError, generateId } from "@paracosm/shared";
import type { MCPConnection } from "../types.js";
import { MCPTransport, type Transport, type TransportMessage } from "./mcp-transport.js";

export interface MCPTool {
  name: string;
  description: string | null;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  } | null;
}

export interface MCPToolResult {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError: boolean;
}

type MCPEventHandler = (data: unknown) => void;

export class MCPClient {
  private connections: Map<string, MCPConnection> = new Map();
  private transport: MCPTransport;
  private activeTransports: Map<string, Transport> = new Map();
  private eventHandlers: Map<string, MCPEventHandler[]> = new Map();
  private toolCache: Map<string, MCPTool[]> = new Map();
  private requestTimeout: number;

  constructor(requestTimeout: number = 30000) {
    this.transport = new MCPTransport();
    this.requestTimeout = requestTimeout;
  }

  connect(serverConfig: MCPServerConfig): void {
    if (this.connections.has(serverConfig.id)) {
      throw new ToolError(`Already connected to server "${serverConfig.id}"`, {
        serverId: serverConfig.id,
      });
    }
    let transport: Transport;
    switch (serverConfig.transport.type) {
      case "stdio":
        if (!serverConfig.transport.command) {
          throw new ToolError("Stdio transport requires a command", { serverId: serverConfig.id });
        }
        transport = this.transport.stdio(
          serverConfig.transport.command,
          serverConfig.transport.args
        );
        break;
      case "sse":
        if (!serverConfig.transport.url) {
          throw new ToolError("SSE transport requires a URL", { serverId: serverConfig.id });
        }
        transport = this.transport.sse(serverConfig.transport.url);
        break;
      case "websocket":
        if (!serverConfig.transport.url) {
          throw new ToolError("WebSocket transport requires a URL", { serverId: serverConfig.id });
        }
        transport = this.transport.websocket(serverConfig.transport.url);
        break;
      default:
        throw new ToolError(`Unsupported transport type: ${serverConfig.transport.type}`, {
          serverId: serverConfig.id,
          transportType: serverConfig.transport.type,
        });
    }

    const connection: MCPConnection = {
      id: serverConfig.id,
      serverConfig,
      status: "connected",
      connectedAt: new Date().toISOString(),
      lastPingAt: new Date().toISOString(),
      errorCount: 0,
      lastError: null,
      toolsAvailable: [],
    };

    transport.onMessage((message) => {
      this.handleMessage(serverConfig.id, message);
    });

    this.connections.set(serverConfig.id, connection);
    this.activeTransports.set(serverConfig.id, transport);
    this.emit("connected", { serverId: serverConfig.id });

    this.refreshToolCache(serverConfig.id);
  }

  disconnect(): void {
    for (const [serverId, connection] of this.connections.entries()) {
      connection.status = "disconnected";
      connection.connectedAt = null;
      const transport = this.activeTransports.get(serverId);
      if (transport) {
        transport.close();
        this.activeTransports.delete(serverId);
      }
      this.toolCache.delete(serverId);
      this.emit("disconnected", { serverId });
    }
    this.connections.clear();
  }

  disconnectServer(serverId: string): void {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return;
    }
    connection.status = "disconnected";
    connection.connectedAt = null;
    const transport = this.activeTransports.get(serverId);
    if (transport) {
      transport.close();
      this.activeTransports.delete(serverId);
    }
    this.connections.delete(serverId);
    this.toolCache.delete(serverId);
    this.emit("disconnected", { serverId });
  }

  listTools(): MCPTool[] {
    const allTools: MCPTool[] = [];
    for (const tools of this.toolCache.values()) {
      allTools.push(...tools);
    }
    return allTools;
  }

  listToolsForServer(serverId: string): MCPTool[] {
    return this.toolCache.get(serverId) ?? [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    let targetServerId: string | null = null;
    for (const [serverId, tools] of this.toolCache.entries()) {
      if (tools.some((t) => t.name === name)) {
        targetServerId = serverId;
        break;
      }
    }
    if (!targetServerId) {
      return {
        content: [{ type: "text", text: `Tool "${name}" not found on any connected server` }],
        isError: true,
      };
    }
    const connection = this.connections.get(targetServerId);
    if (!connection || connection.status !== "connected") {
      return {
        content: [{ type: "text", text: `Server "${targetServerId}" is not connected` }],
        isError: true,
      };
    }
    const transport = this.activeTransports.get(targetServerId);
    if (!transport || !transport.connected) {
      return {
        content: [{ type: "text", text: `Transport for server "${targetServerId}" is not active` }],
        isError: true,
      };
    }
    const message: TransportMessage = {
      id: generateId(),
      type: "request",
      method: "tools/call",
      params: { name, arguments: args },
      timestamp: new Date().toISOString(),
    };
    try {
      transport.send(message);
      connection.lastPingAt = new Date().toISOString();
      return {
        content: [{ type: "text", text: `Tool "${name}" called with arguments: ${JSON.stringify(args)}` }],
        isError: false,
      };
    } catch (error) {
      connection.errorCount++;
      connection.lastError = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error calling tool "${name}": ${connection.lastError}` }],
        isError: true,
      };
    }
  }

  subscribe(event: string, handler: MCPEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  unsubscribe(event: string, handler: MCPEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  handleNotification(notification: TransportMessage): void {
    if (notification.method) {
      this.emit(`notification:${notification.method}`, notification.params);
    }
    this.emit("notification", notification);
  }

  getConnections(): MCPConnection[] {
    return Array.from(this.connections.values());
  }

  getConnection(serverId: string): MCPConnection | undefined {
    return this.connections.get(serverId);
  }

  isConnected(serverId: string): boolean {
    const connection = this.connections.get(serverId);
    return connection?.status === "connected";
  }

  private refreshToolCache(serverId: string): void {
    const connection = this.connections.get(serverId);
    if (!connection) return;
    const config = connection.serverConfig;
    const tools: MCPTool[] = config.toolIds.map((toolId) => ({
      name: toolId,
      description: `MCP tool from ${config.name}`,
      inputSchema: null,
    }));
    this.toolCache.set(serverId, tools);
    connection.toolsAvailable = tools.map((t) => t.name);
  }

  private handleMessage(serverId: string, message: TransportMessage): void {
    const connection = this.connections.get(serverId);
    if (!connection) return;
    connection.lastPingAt = new Date().toISOString();
    if (message.type === "notification") {
      this.handleNotification(message);
    }
    if (message.type === "response" && message.error) {
      connection.errorCount++;
      connection.lastError = message.error.message;
    }
    this.emit("message", { serverId, message });
  }

  private emit(event: string, data: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch {
          // handler error, continue
        }
      }
    }
  }
}
