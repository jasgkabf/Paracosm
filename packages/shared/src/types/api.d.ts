export interface APIRequest {
    id: string;
    method: string;
    path: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    body?: unknown;
    timestamp: Date;
    metadata: Record<string, unknown>;
}
export interface APIResponse {
    id: string;
    requestId: string;
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
    duration: number;
    timestamp: Date;
    metadata: Record<string, unknown>;
}
export type WebSocketEventType = 'connected' | 'disconnected' | 'message' | 'error' | 'heartbeat' | 'chat' | 'simulation' | 'notification';
export interface WebSocketMessage {
    id: string;
    type: WebSocketEventType;
    payload: unknown;
    timestamp: Date;
    metadata: Record<string, unknown>;
}
export interface ChatRequest {
    id: string;
    message: string;
    context?: string[];
    personas?: string[];
    stream: boolean;
    temperature?: number;
    maxTokens?: number;
    metadata: Record<string, unknown>;
}
export interface ChatResponse {
    id: string;
    requestId: string;
    message: string;
    personaId?: string;
    model: string;
    provider: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    duration: number;
    metadata: Record<string, unknown>;
}
export type StreamEventType = 'token' | 'start' | 'end' | 'error' | 'metadata' | 'tool_call' | 'tool_result';
export interface StreamEvent {
    type: StreamEventType;
    data: unknown;
    timestamp: Date;
}
export interface PaginationParams {
    page: number;
    pageSize: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    cursor?: string;
}
export interface PaginationResponse<T> {
    data: T[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
        cursor?: string;
    };
}
//# sourceMappingURL=api.d.ts.map