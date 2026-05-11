import type { MCPConfig } from '@paracosm/shared';
import { ok, err, type Result, createLogger } from '@paracosm/shared';

const logger = createLogger('MCPTransport');

export class MCPTransport {
  private config: MCPConfig | null = null;
  private connected: boolean = false;

  async connect(config: MCPConfig): Promise<Result<boolean>> {
    this.config = config;
    this.connected = true;
    logger.info(`MCP transport connected: ${config.protocol} to ${config.serverName}`);
    return ok(true);
  }

  async disconnect(): Promise<Result<boolean>> {
    this.connected = false;
    this.config = null;
    return ok(true);
  }

  async send(data: unknown): Promise<Result<unknown>> {
    if (!this.connected || !this.config) {
      return err(new Error('Transport not connected'));
    }
    return ok({ received: true, data });
  }

  async receive(): Promise<Result<unknown>> {
    if (!this.connected || !this.config) {
      return err(new Error('Transport not connected'));
    }
    return ok(null);
  }

  isConnected(): boolean {
    return this.connected;
  }

  getProtocol(): string | null {
    return this.config?.protocol ?? null;
  }
}
