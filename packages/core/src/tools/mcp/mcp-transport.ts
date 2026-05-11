import type { MCPTransportType, MCPTransportConfig } from "@paracosm/shared";
import { ToolError, generateId } from "@paracosm/shared";

export interface Transport {
  id: string;
  type: MCPTransportType;
  connected: boolean;
  createdAt: string;
  lastActivityAt: string;
  send(message: TransportMessage): void;
  onMessage(handler: (message: TransportMessage) => void): void;
  close(): void;
}

export interface TransportMessage {
  id: string;
  type: "request" | "response" | "notification";
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  timestamp: string;
}

export class MCPTransport {
  private activeTransports: Map<string, Transport> = new Map();
  private messageHandlers: Map<string, Array<(message: TransportMessage) => void>> = new Map();

  stdio(command: string, args: string[] = []): Transport {
    const id = generateId();
    const config: MCPTransportConfig = {
      type: "stdio" as MCPTransportType,
      command,
      args,
      url: null,
      headers: {},
      env: {},
      restartOnFailure: true,
      maxRestartAttempts: 3,
      restartDelayMs: 1000,
    };
    const transport = this.createTransport(id, config);
    this.activeTransports.set(id, transport);
    return transport;
  }

  sse(url: string): Transport {
    const id = generateId();
    const config: MCPTransportConfig = {
      type: "sse" as MCPTransportType,
      command: null,
      args: [],
      url,
      headers: {},
      env: {},
      restartOnFailure: true,
      maxRestartAttempts: 3,
      restartDelayMs: 2000,
    };
    const transport = this.createTransport(id, config);
    this.activeTransports.set(id, transport);
    return transport;
  }

  websocket(url: string): Transport {
    const id = generateId();
    const config: MCPTransportConfig = {
      type: "websocket" as MCPTransportType,
      command: null,
      args: [],
      url,
      headers: {},
      env: {},
      restartOnFailure: true,
      maxRestartAttempts: 3,
      restartDelayMs: 1000,
    };
    const transport = this.createTransport(id, config);
    this.activeTransports.set(id, transport);
    return transport;
  }

  getTransport(id: string): Transport | undefined {
    return this.activeTransports.get(id);
  }

  getActiveTransports(): Transport[] {
    return Array.from(this.activeTransports.values()).filter((t) => t.connected);
  }

  closeTransport(id: string): void {
    const transport = this.activeTransports.get(id);
    if (transport) {
      transport.close();
      this.activeTransports.delete(id);
    }
  }

  closeAll(): void {
    for (const transport of this.activeTransports.values()) {
      transport.close();
    }
    this.activeTransports.clear();
  }

  frameMessage(message: TransportMessage): string {
    const framed = {
      jsonrpc: "2.0",
      ...message,
    };
    return JSON.stringify(framed);
  }

  parseMessage(raw: string): TransportMessage {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.id || !parsed.type) {
        throw new ToolError("Invalid MCP message: missing id or type", { raw: raw.slice(0, 200) });
      }
      return {
        id: parsed.id,
        type: parsed.type,
        method: parsed.method,
        params: parsed.params,
        result: parsed.result,
        error: parsed.error,
        timestamp: parsed.timestamp ?? new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw new ToolError(
        `Failed to parse MCP message: ${error instanceof Error ? error.message : String(error)}`,
        { raw: raw.slice(0, 200) }
      );
    }
  }

  private createTransport(id: string, config: MCPTransportConfig): Transport {
    const now = new Date().toISOString();
    const handlers: Array<(message: TransportMessage) => void> = [];
    let connected = true;

    const transport: Transport = {
      id,
      type: config.type,
      connected,
      createdAt: now,
      lastActivityAt: now,
      send(message: TransportMessage): void {
        if (!connected) {
          throw new ToolError(`Transport ${id} is not connected`, { transportId: id });
        }
        transport.lastActivityAt = new Date().toISOString();
        const framed = new MCPTransport().frameMessage(message);
        void framed;
      },
      onMessage(handler: (message: TransportMessage) => void): void {
        handlers.push(handler);
      },
      close(): void {
        connected = false;
        transport.connected = false;
      },
    };

    this.messageHandlers.set(id, handlers);
    return transport;
  }
}
