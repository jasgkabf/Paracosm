import type { FastifyRequest } from "fastify";
import { createLogger, generateId } from "@paracosm/shared";
import { WSAuth } from "./ws-auth.js";
import {
  WSEventType,
  WSEventNames,
  createWSEvent,
  parseWSEvent,
  validateWSEvent,
  type WSEvent,
  type WSEventName,
} from "./ws-events.js";

const logger = createLogger("api:ws:handler");

interface WSMessage {
  action: "subscribe" | "unsubscribe" | "ping" | "event";
  channel?: string;
  event?: WSEvent;
  correlationId?: string;
}

interface WSResponse {
  action: string;
  success: boolean;
  data?: unknown;
  error?: string;
  correlationId?: string;
  timestamp: string;
}

export class WSHandler {
  private auth: WSAuth;

  constructor(auth: WSAuth) {
    this.auth = auth;
  }

  route(data: string, connectionId: string, sessionId: string): WSResponse {
    const message = this.deserialize(data);
    if (!message) {
      return this.errorResponse("Invalid message format", null);
    }

    switch (message.action) {
      case "subscribe":
        return this.handleSubscribe(message, connectionId, sessionId);
      case "unsubscribe":
        return this.handleUnsubscribe(message, connectionId, sessionId);
      case "ping":
        return this.handlePing(message);
      case "event":
        return this.handleEvent(message, connectionId, sessionId);
      default:
        return this.errorResponse(`Unknown action: ${message.action}`, message.correlationId);
    }
  }

  private handleSubscribe(message: WSMessage, connectionId: string, sessionId: string): WSResponse {
    const channel = message.channel;
    if (!channel) {
      return this.errorResponse("Channel is required for subscribe", message.correlationId);
    }

    const validChannels = WSEventNames;
    if (!validChannels.includes(channel as WSEventName) && channel !== "*") {
      return this.errorResponse(
        `Invalid channel: ${channel}. Valid channels: ${validChannels.join(", ")}`,
        message.correlationId
      );
    }

    const session = this.auth.getSession(sessionId);
    if (session) {
      this.auth.addSessionToRoom(sessionId, channel);
    }

    logger.debug("Client subscribed to channel", { connectionId, channel });

    return {
      action: "subscribed",
      success: true,
      data: { channel },
      correlationId: message.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  private handleUnsubscribe(message: WSMessage, connectionId: string, sessionId: string): WSResponse {
    const channel = message.channel;
    if (!channel) {
      return this.errorResponse("Channel is required for unsubscribe", message.correlationId);
    }

    const session = this.auth.getSession(sessionId);
    if (session) {
      this.auth.removeSessionFromRoom(sessionId, channel);
    }

    logger.debug("Client unsubscribed from channel", { connectionId, channel });

    return {
      action: "unsubscribed",
      success: true,
      data: { channel },
      correlationId: message.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  private handlePing(message: WSMessage): WSResponse {
    return {
      action: "pong",
      success: true,
      correlationId: message.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  private handleEvent(message: WSMessage, connectionId: string, sessionId: string): WSResponse {
    if (!message.event) {
      return this.errorResponse("Event data is required", message.correlationId);
    }

    const validation = validateWSEvent(message.event);
    if (!validation.valid) {
      return this.errorResponse(`Invalid event: ${validation.errors.join(", ")}`, message.correlationId);
    }

    const session = this.auth.getSession(sessionId);
    if (!session) {
      return this.errorResponse("Session not found", message.correlationId);
    }

    const requiredScope = this.getScopeForEvent(message.event.type);
    if (requiredScope && !session.scopes.includes("admin") && !session.scopes.includes(requiredScope)) {
      return this.errorResponse(
        `Insufficient permissions for event type: ${message.event.type}`,
        message.correlationId
      );
    }

    this.auth.updateSessionActivity(sessionId);

    logger.debug("Event received", {
      connectionId,
      eventType: message.event.type,
      sessionId,
    });

    return {
      action: "event_ack",
      success: true,
      data: { eventId: message.event.id },
      correlationId: message.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  private getScopeForEvent(eventType: WSEventName): string | null {
    const scopeMap: Record<string, string> = {
      [WSEventType.ChatStream]: "chat:write",
      [WSEventType.SimulationProgress]: "simulation:write",
      [WSEventType.WorldUpdate]: "world:write",
      [WSEventType.StrategyEvolved]: "strategy:write",
      [WSEventType.SystemNotification]: "admin",
      [WSEventType.HeartbeatBeat]: "heartbeat:read",
    };
    return scopeMap[eventType] ?? null;
  }

  deserialize(data: string): WSMessage | null {
    try {
      const parsed = JSON.parse(data);

      if (!parsed.action || typeof parsed.action !== "string") {
        return null;
      }

      const validActions = ["subscribe", "unsubscribe", "ping", "event"];
      if (!validActions.includes(parsed.action)) {
        return null;
      }

      const message: WSMessage = {
        action: parsed.action,
        channel: parsed.channel ?? undefined,
        correlationId: parsed.correlationId ?? undefined,
      };

      if (parsed.action === "event" && parsed.event) {
        const wsEvent = parseWSEvent(JSON.stringify(parsed.event));
        if (wsEvent) {
          message.event = wsEvent;
        }
      }

      return message;
    } catch {
      return null;
    }
  }

  serialize(response: WSResponse): string {
    return JSON.stringify(response);
  }

  validate(data: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const parsed = JSON.parse(data);

      if (!parsed.action || typeof parsed.action !== "string") {
        errors.push("Action is required and must be a string");
      }

      const validActions = ["subscribe", "unsubscribe", "ping", "event"];
      if (parsed.action && !validActions.includes(parsed.action)) {
        errors.push(`Invalid action: ${parsed.action}. Must be one of: ${validActions.join(", ")}`);
      }

      if (parsed.action === "subscribe" || parsed.action === "unsubscribe") {
        if (!parsed.channel || typeof parsed.channel !== "string") {
          errors.push("Channel is required for subscribe/unsubscribe actions");
        }
      }

      if (parsed.action === "event" && !parsed.event) {
        errors.push("Event data is required for event action");
      }

      if (parsed.event) {
        const eventValidation = validateWSEvent(parsed.event);
        if (!eventValidation.valid) {
          errors.push(...eventValidation.errors);
        }
      }
    } catch {
      errors.push("Invalid JSON format");
    }

    return { valid: errors.length === 0, errors };
  }

  private errorResponse(message: string, correlationId: string | null | undefined): WSResponse {
    return {
      action: "error",
      success: false,
      error: message,
      correlationId: correlationId ?? undefined,
      timestamp: new Date().toISOString(),
    };
  }

  createSubscriptionMessage(channel: string, payload: unknown): string {
    const event = createWSEvent(channel as WSEventName, payload);
    return this.serialize({
      action: "event",
      success: true,
      data: event,
      timestamp: new Date().toISOString(),
    });
  }
}
