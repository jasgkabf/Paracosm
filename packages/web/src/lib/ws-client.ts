const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";

type WsEventHandler = (data: unknown) => void;
type WsConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";

interface WsClientOptions {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

class WsClient {
  private url: string;
  private ws: WebSocket | null = null;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private heartbeatInterval: number;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private handlers: Map<string, Set<WsEventHandler>> = new Map();
  private state: WsConnectionState = "disconnected";
  private stateListeners: Set<(state: WsConnectionState) => void> = new Set();

  constructor(options: WsClientOptions = {}) {
    this.url = options.url || WS_BASE_URL;
    this.reconnectInterval = options.reconnectInterval || 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.setState("connecting");

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.setState("connected");
        this.reconnectAttempts = 0;
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const eventType = message.type || "message";
          const handlers = this.handlers.get(eventType);
          if (handlers) {
            handlers.forEach((handler) => handler(message.payload || message));
          }

          const allHandlers = this.handlers.get("*");
          if (allHandlers) {
            allHandlers.forEach((handler) => handler(message));
          }
        } catch {
          const rawHandlers = this.handlers.get("raw");
          if (rawHandlers) {
            rawHandlers.forEach((handler) => handler(event.data));
          }
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.setState("disconnected");
        this.attemptReconnect();
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.setState("disconnected");
      this.attemptReconnect();
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts;
    this.ws?.close();
    this.ws = null;
    this.setState("disconnected");
  }

  send(type: string, payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
    }
  }

  on(event: string, handler: WsEventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  off(event: string, handler: WsEventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  onStateChange(listener: (state: WsConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  getState(): WsConnectionState {
    return this.state;
  }

  private setState(state: WsConnectionState): void {
    this.state = state;
    this.stateListeners.forEach((listener) => listener(state));
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    this.setState("reconnecting");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, this.reconnectInterval * Math.min(this.reconnectAttempts + 1, 5));
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send("ping", { timestamp: Date.now() });
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export const wsClient = new WsClient();

export { WsClient };
export type { WsConnectionState, WsClientOptions };
