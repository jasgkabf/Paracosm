import type { Pagination, SortOrder } from "./common.js";

export interface APIRequest {
  id: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  timestamp: string;
  requestId: string;
  clientIp: string;
  userAgent: string;
}

export interface APIResponse {
  requestId: string;
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  duration: number;
  timestamp: string;
}

export interface APIError {
  code: string;
  message: string;
  details: Record<string, unknown>;
  stack: string | null;
  timestamp: string;
}

export enum WebSocketEventType {
  Connection = "connection",
  Disconnection = "disconnection",
  Message = "message",
  Error = "error",
  Ping = "ping",
  Pong = "pong",
  Subscribe = "subscribe",
  Unsubscribe = "unsubscribe",
}

export interface WebSocketMessage {
  id: string;
  type: WebSocketEventType;
  channel: string;
  payload: unknown;
  timestamp: string;
  senderId: string | null;
  correlationId: string | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface ChatRequest {
  id: string;
  messages: ChatMessage[];
  model: string | null;
  temperature: number | null;
  maxTokens: number | null;
  stream: boolean;
  context: Record<string, unknown>;
  sessionId: string;
}

export interface ChatResponse {
  id: string;
  requestId: string;
  message: ChatMessage;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
  duration: number;
}

export enum StreamEventType {
  Token = "token",
  MessageStart = "message_start",
  MessageEnd = "message_end",
  ToolCall = "tool_call",
  ToolResult = "tool_result",
  Error = "error",
  Done = "done",
}

export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
  timestamp: string;
  requestId: string;
  sequenceNumber: number;
}

export interface StreamTokenEvent extends StreamEvent {
  type: StreamEventType.Token;
  data: {
    token: string;
    logprob: number | null;
  };
}

export interface StreamMessageStartEvent extends StreamEvent {
  type: StreamEventType.MessageStart;
  data: {
    messageId: string;
    model: string;
  };
}

export interface StreamMessageEndEvent extends StreamEvent {
  type: StreamEventType.MessageEnd;
  data: {
    messageId: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    finishReason: string;
  };
}

export interface StreamToolCallEvent extends StreamEvent {
  type: StreamEventType.ToolCall;
  data: {
    toolId: string;
    toolName: string;
    arguments: string;
  };
}

export interface StreamToolResultEvent extends StreamEvent {
  type: StreamEventType.ToolResult;
  data: {
    toolId: string;
    result: unknown;
    error: string | null;
  };
}

export interface StreamErrorEvent extends StreamEvent {
  type: StreamEventType.Error;
  data: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface StreamDoneEvent extends StreamEvent {
  type: StreamEventType.Done;
  data: Record<string, unknown>;
}

export interface PaginationParams {
  offset: number;
  limit: number;
  sortBy: string | null;
  sortOrder: SortOrder | null;
}

export interface PaginationResponse<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}
