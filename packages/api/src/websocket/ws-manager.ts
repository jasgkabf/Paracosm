import type { FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import { createLogger, generateId } from "@paracosm/shared";
import { WSAuth } from "./ws-auth.js";
import { WSHandler } from "./ws-handler.js";
import { WSEventType, type WSEventName, createWSEvent } from "./ws-events.js";

const logger = createLogger("api:ws:manager");

interface WSConnection {
  id: string;
  socket: WebSocket;
  sessionId: string;
  userId: string;
  rooms: Set<string>;
  connectedAt: string;
  lastActivityAt: string;
  messageCount: number;
  isAuthenticated: boolean;
}

export class WSManager {
  private connections: Map<string, WSConnection> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  private auth: WSAuth;
  private handler: WSHandler;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.auth = new WSAuth();
    this.handler = new WSHandler(this.auth);
    this.startHeartbeat();
  }

  handleConnection(socket: WebSocket, request: FastifyRequest): void {
    const connectionId = generateId();
    const authResult = this.auth.authenticate(request);

    const connection: WSConnection = {
      id: connectionId,
      socket,
      sessionId: "",
      userId: authResult.userId ?? "anonymous",
      rooms: new Set(),
      connectedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      messageCount: 0,
      isAuthenticated: authResult.authenticated,
    };

    if (authResult.authenticated) {
      const session = this.auth.createSession(
        authResult.userId ?? "anonymous",
        connectionId,
        authResult.scopes
      );
      connection.sessionId = session.sessionId;
    }

    this.connections.set(connectionId, connection);

    logger.info("WebSocket connection established", {
      connectionId,
      userId: connection.userId,
      authenticated: connection.isAuthenticated,
      totalConnections: this.connections.size,
    });

    socket.on("message", (data: Buffer) => {
      this.handleMessage(connectionId, data.toString());
    });

    socket.on("close", (code: number, reason: Buffer) => {
      this.handleDisconnection(connectionId, code, reason.toString());
    });

    socket.on("error", (error: Error) => {
      logger.error("WebSocket error", error, { connectionId });
    });

    socket.on("ping", () => {
      connection.lastActivityAt = new Date().toISOString();
      socket.pong();
    });

    const welcomeEvent = createWSEvent(WSEventType.SystemNotification, {
      message: "Connected to Paracosm WebSocket server",
      connectionId,
      authenticated: connection.isAuthenticated,
      serverTime: new Date().toISOString(),
    });

    this.sendToConnection(connectionId, JSON.stringify(welcomeEvent));
  }

  handleDisconnection(connectionId: string, code: number, reason: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    for (const room of connection.rooms) {
      const roomConnections = this.rooms.get(room);
      if (roomConnections) {
        roomConnections.delete(connectionId);
        if (roomConnections.size === 0) {
          this.rooms.delete(room);
        }
      }
    }

    if (connection.sessionId) {
      this.auth.destroySession(connection.sessionId);
    }

    this.connections.delete(connectionId);

    logger.info("WebSocket connection closed", {
      connectionId,
      userId: connection.userId,
      code,
      reason,
      totalConnections: this.connections.size,
    });
  }

  private handleMessage(connectionId: string, data: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    connection.messageCount++;
    connection.lastActivityAt = new Date().toISOString();

    const validation = this.handler.validate(data);
    if (!validation.valid) {
      this.sendToConnection(
        connectionId,
        JSON.stringify({
          action: "error",
          success: false,
          error: `Invalid message: ${validation.errors.join(", ")}`,
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    const response = this.handler.route(data, connectionId, connection.sessionId);
    this.sendToConnection(connectionId, this.handler.serialize(response));

    if (response.success && response.action === "subscribed" && response.data) {
      const channel = (response.data as Record<string, string>).channel;
      if (channel) {
        this.subscribeToRoom(connectionId, channel);
      }
    }

    if (response.success && response.action === "unsubscribed" && response.data) {
      const channel = (response.data as Record<string, string>).channel;
      if (channel) {
        this.unsubscribeFromRoom(connectionId, channel);
      }
    }
  }

  broadcast(channel: WSEventName | string, payload: unknown): void {
    const event = createWSEvent(channel as WSEventName, payload);
    const message = JSON.stringify(event);

    const roomConnections = this.rooms.get(channel);
    if (roomConnections) {
      for (const connectionId of roomConnections) {
        this.sendToConnection(connectionId, message);
      }
    }

    const wildcardConnections = this.rooms.get("*");
    if (wildcardConnections && channel !== "*") {
      for (const connectionId of wildcardConnections) {
        if (!roomConnections || !roomConnections.has(connectionId)) {
          this.sendToConnection(connectionId, message);
        }
      }
    }
  }

  broadcastToUser(userId: string, channel: WSEventName | string, payload: unknown): void {
    const event = createWSEvent(channel as WSEventName, payload);
    const message = JSON.stringify(event);

    for (const [connectionId, connection] of this.connections) {
      if (connection.userId === userId) {
        this.sendToConnection(connectionId, message);
      }
    }
  }

  private subscribeToRoom(connectionId: string, room: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    connection.rooms.add(room);

    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room)!.add(connectionId);

    logger.debug("Connection subscribed to room", { connectionId, room });
  }

  private unsubscribeFromRoom(connectionId: string, room: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    connection.rooms.delete(room);

    const roomConnections = this.rooms.get(room);
    if (roomConnections) {
      roomConnections.delete(connectionId);
      if (roomConnections.size === 0) {
        this.rooms.delete(room);
      }
    }

    logger.debug("Connection unsubscribed from room", { connectionId, room });
  }

  private sendToConnection(connectionId: string, message: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.socket.readyState !== 1) {
      return;
    }

    try {
      connection.socket.send(message);
    } catch (error) {
      logger.error("Failed to send WebSocket message", error as Error, { connectionId });
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [connectionId, connection] of this.connections) {
        if (connection.socket.readyState === 1) {
          try {
            connection.socket.ping();
          } catch {
            this.handleDisconnection(connectionId, 1006, "Ping failed");
          }
        } else if (connection.socket.readyState >= 2) {
          this.handleDisconnection(connectionId, 1006, "Socket closed");
        }
      }
    }, 30000);
  }

  closeAll(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    for (const [connectionId, connection] of this.connections) {
      try {
        connection.socket.close(1001, "Server shutting down");
      } catch {
        // Socket already closed
      }
    }

    this.connections.clear();
    this.rooms.clear();
    logger.info("All WebSocket connections closed");
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getRoomMembers(room: string): string[] {
    return Array.from(this.rooms.get(room) ?? []);
  }

  getConnectionsByUser(userId: string): WSConnection[] {
    return Array.from(this.connections.values()).filter((c) => c.userId === userId);
  }

  getStats(): {
    totalConnections: number;
    authenticatedConnections: number;
    totalRooms: number;
    rooms: Record<string, number>;
    totalMessages: number;
  } {
    let totalMessages = 0;
    let authenticatedConnections = 0;

    for (const connection of this.connections.values()) {
      totalMessages += connection.messageCount;
      if (connection.isAuthenticated) {
        authenticatedConnections++;
      }
    }

    const rooms: Record<string, number> = {};
    for (const [room, members] of this.rooms) {
      rooms[room] = members.size;
    }

    return {
      totalConnections: this.connections.size,
      authenticatedConnections,
      totalRooms: this.rooms.size,
      rooms,
      totalMessages,
    };
  }
}
