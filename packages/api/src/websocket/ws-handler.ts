import { createLogger } from '@paracosm/shared';
import type { WSEventBus, WSEvent } from './ws-events.js';
import type { WSConnection } from './ws-manager.js';

const logger = createLogger('WSHandler');

interface WSMessage {
  id: string;
  type: string;
  payload: unknown;
  timestamp?: string;
}

export class WSHandler {
  private eventBus: WSEventBus;
  private messageHandlers: Map<string, (connection: WSConnection, payload: unknown) => void> = new Map();

  constructor(eventBus: WSEventBus) {
    this.eventBus = eventBus;
    this.registerDefaultHandlers();
  }

  handleMessage(connection: WSConnection, rawMessage: string): void {
    let message: WSMessage;

    try {
      message = JSON.parse(rawMessage);
    } catch {
      logger.warn('Invalid WebSocket message', { connectionId: connection.id });
      this.sendError(connection, 'invalid_message', 'Message must be valid JSON');
      return;
    }

    if (!message.type) {
      this.sendError(connection, 'invalid_message', 'Message type is required');
      return;
    }

    const event: WSEvent = {
      type: this.mapMessageType(message.type),
      payload: message.payload,
      timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
    };

    this.eventBus.emit(event);

    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      try {
        handler(connection, message.payload);
      } catch (error) {
        logger.error('Message handler error', {
          type: message.type,
          connectionId: connection.id,
          error: (error as Error).message,
        });
        this.sendError(connection, 'handler_error', (error as Error).message);
      }
    } else {
      logger.debug('No handler for message type', {
        type: message.type,
        connectionId: connection.id,
      });
    }
  }

  registerHandler(type: string, handler: (connection: WSConnection, payload: unknown) => void): void {
    this.messageHandlers.set(type, handler);
  }

  removeHandler(type: string): boolean {
    return this.messageHandlers.delete(type);
  }

  private registerDefaultHandlers(): void {
    this.registerHandler('ping', (connection) => {
      this.sendToConnection(connection, {
        type: 'heartbeat',
        payload: { pong: true, timestamp: Date.now() },
        timestamp: new Date(),
      });
    });

    this.registerHandler('subscribe', (connection, payload) => {
      const data = payload as { channel?: string };
      if (data.channel) {
        connection.subscriptions.add(data.channel);
        this.sendToConnection(connection, {
          type: 'notification',
          payload: { subscribed: data.channel },
          timestamp: new Date(),
        });
      }
    });

    this.registerHandler('unsubscribe', (connection, payload) => {
      const data = payload as { channel?: string };
      if (data.channel) {
        connection.subscriptions.delete(data.channel);
        this.sendToConnection(connection, {
          type: 'notification',
          payload: { unsubscribed: data.channel },
          timestamp: new Date(),
        });
      }
    });

    this.registerHandler('chat', (connection, payload) => {
      const data = payload as { message?: string };
      this.sendToConnection(connection, {
        type: 'chat',
        payload: { response: `Echo: ${data.message ?? ''}`, timestamp: Date.now() },
        timestamp: new Date(),
      });
    });

    this.registerHandler('auth', (connection, payload) => {
      const data = payload as { token?: string };
      if (data.token) {
        connection.authenticated = true;
        this.sendToConnection(connection, {
          type: 'notification',
          payload: { authenticated: true },
          timestamp: new Date(),
        });
      } else {
        this.sendError(connection, 'auth_failed', 'Token is required');
      }
    });
  }

  private sendToConnection(connection: WSConnection, event: WSEvent): void {
    if (connection.socket.readyState === WebSocket.OPEN) {
      try {
        connection.socket.send(JSON.stringify(event));
      } catch (error) {
        logger.error('Failed to send WebSocket message', {
          connectionId: connection.id,
          error: (error as Error).message,
        });
      }
    }
  }

  private sendError(connection: WSConnection, code: string, message: string): void {
    this.sendToConnection(connection, {
      type: 'error',
      payload: { code, message },
      timestamp: new Date(),
    });
  }

  private mapMessageType(type: string): WSEvent['type'] {
    const mapping: Record<string, WSEvent['type']> = {
      ping: 'heartbeat',
      chat: 'chat',
      subscribe: 'notification',
      unsubscribe: 'notification',
      auth: 'notification',
      simulation: 'simulation',
      world_update: 'world_update',
    };
    return mapping[type] ?? 'message';
  }
}
