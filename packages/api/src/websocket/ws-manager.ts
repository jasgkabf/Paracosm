import { createLogger, generateId } from '@paracosm/shared';
import type { WSEvent } from './ws-events.js';
import { WSEventBus } from './ws-events.js';
import { WSHandler } from './ws-handler.js';
import { WSAuth } from './ws-auth.js';

const logger = createLogger('WebSocketManager');

export interface WSConnection {
  id: string;
  socket: WebSocket;
  authenticated: boolean;
  userId?: string;
  connectedAt: number;
  lastActivity: number;
  subscriptions: Set<string>;
  metadata: Record<string, unknown>;
}

export class WebSocketManager {
  private connections: Map<string, WSConnection> = new Map();
  private eventBus: WSEventBus;
  private handler: WSHandler;
  private auth: WSAuth;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatMs: number = 30000;
  private maxConnections: number = 1000;
  private maxIdleMs: number = 300000;

  constructor() {
    this.eventBus = new WSEventBus();
    this.handler = new WSHandler(this.eventBus);
    this.auth = new WSAuth();
    this.startHeartbeat();
  }

  handleConnection(socket: WebSocket): void {
    if (this.connections.size >= this.maxConnections) {
      logger.warn('Max WebSocket connections reached, rejecting');
      socket.close(1013, 'Max connections reached');
      return;
    }

    const id = generateId();
    const connection: WSConnection = {
      id,
      socket,
      authenticated: false,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      subscriptions: new Set(),
      metadata: {},
    };

    this.connections.set(id, connection);
    logger.info('WebSocket connected', { id, totalConnections: this.connections.size });

    socket.on('message', (data: Buffer | string) => {
      try {
        const message = typeof data === 'string' ? data : data.toString();
        connection.lastActivity = Date.now();
        this.handler.handleMessage(connection, message);
      } catch (error) {
        logger.error('WebSocket message error', {
          connectionId: id,
          error: (error as Error).message,
        });
      }
    });

    socket.on('close', (code: number, reason: Buffer) => {
      this.removeConnection(id);
      logger.info('WebSocket disconnected', {
        id,
        code,
        reason: reason.toString(),
      });
    });

    socket.on('error', (error: Error) => {
      logger.error('WebSocket error', {
        connectionId: id,
        error: error.message,
      });
      this.removeConnection(id);
    });

    socket.on('ping', () => {
      connection.lastActivity = Date.now();
      socket.pong();
    });

    this.sendToConnection(id, {
      type: 'connected',
      payload: { connectionId: id },
      timestamp: new Date(),
    });
  }

  sendToConnection(connectionId: string, event: WSEvent): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      connection.socket.send(JSON.stringify(event));
      connection.lastActivity = Date.now();
      return true;
    } catch (error) {
      logger.error('Failed to send to connection', {
        connectionId,
        error: (error as Error).message,
      });
      return false;
    }
  }

  broadcast(event: WSEvent, filter?: (connection: WSConnection) => boolean): number {
    let sent = 0;

    for (const [id, connection] of this.connections) {
      if (connection.socket.readyState !== WebSocket.OPEN) continue;
      if (filter && !filter(connection)) continue;

      if (this.sendToConnection(id, event)) {
        sent++;
      }
    }

    return sent;
  }

  broadcastToSubscription(channel: string, event: WSEvent): number {
    return this.broadcast(event, (conn) => conn.subscriptions.has(channel));
  }

  subscribe(connectionId: string, channel: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    connection.subscriptions.add(channel);
    logger.info('Subscription added', { connectionId, channel });
    return true;
  }

  unsubscribe(connectionId: string, channel: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    connection.subscriptions.delete(channel);
    logger.info('Subscription removed', { connectionId, channel });
    return true;
  }

  authenticate(connectionId: string, token: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    const result = this.auth.validateToken(token);
    if (result.valid) {
      connection.authenticated = true;
      connection.userId = result.userId;
      logger.info('WebSocket authenticated', { connectionId, userId: result.userId });
      return true;
    }

    logger.warn('WebSocket authentication failed', { connectionId });
    return false;
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getConnections(): Array<{ id: string; authenticated: boolean; userId?: string; subscriptions: string[] }> {
    return Array.from(this.connections.values()).map((c) => ({
      id: c.id,
      authenticated: c.authenticated,
      userId: c.userId,
      subscriptions: Array.from(c.subscriptions),
    }));
  }

  getEventBus(): WSEventBus {
    return this.eventBus;
  }

  closeAll(): void {
    for (const [id, connection] of this.connections) {
      try {
        connection.socket.close(1001, 'Server shutting down');
      } catch (error) {
        logger.error('Error closing WebSocket', { connectionId: id, error: (error as Error).message });
      }
    }
    this.connections.clear();

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private removeConnection(id: string): void {
    const connection = this.connections.get(id);
    if (connection) {
      connection.subscriptions.clear();
      this.connections.delete(id);
      logger.info('Connection removed', { id, remainingConnections: this.connections.size });
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();

      for (const [id, connection] of this.connections) {
        if (now - connection.lastActivity > this.maxIdleMs) {
          logger.info('Closing idle WebSocket connection', { connectionId: id });
          try {
            connection.socket.close(1000, 'Idle timeout');
          } catch {
            this.removeConnection(id);
          }
          continue;
        }

        if (connection.socket.readyState === WebSocket.OPEN) {
          try {
            connection.socket.ping();
          } catch {
            this.removeConnection(id);
          }
        } else {
          this.removeConnection(id);
        }
      }
    }, this.heartbeatMs);
  }
}
