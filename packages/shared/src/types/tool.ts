export type ToolId = string;

export type ToolType =
  | 'search'
  | 'code_execution'
  | 'file_operation'
  | 'api_call'
  | 'database'
  | 'computation'
  | 'communication'
  | 'mcp'
  | 'plugin';

export interface Tool {
  id: ToolId;
  name: string;
  type: ToolType;
  description: string;
  version: string;
  config: ToolConfig;
  permissions: ToolPermission[];
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolResult {
  toolId: ToolId;
  success: boolean;
  output: unknown;
  error?: string;
  duration: number;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export interface ToolConfig {
  timeout: number;
  retries: number;
  maxConcurrentCalls: number;
  rateLimitPerMinute: number;
  cacheResults: boolean;
  cacheTtlMs: number;
  parameters: Record<string, unknown>;
  environment: Record<string, string>;
}

export interface ToolPermission {
  resource: string;
  actions: Array<'read' | 'write' | 'execute' | 'delete' | 'admin'>;
  constraints: Record<string, unknown>;
}

export interface MCPConfig {
  serverUrl: string;
  serverName: string;
  protocol: 'stdio' | 'http' | 'websocket';
  transport: string;
  capabilities: string[];
  tools: ToolId[];
  headers?: Record<string, string>;
  reconnect: boolean;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  metadata: Record<string, unknown>;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  tools: Tool[];
  mcpConfigs: MCPConfig[];
  dependencies: Record<string, string>;
  permissions: ToolPermission[];
  entryPoint: string;
  enabled: boolean;
  installedAt: Date;
  metadata: Record<string, unknown>;
}
