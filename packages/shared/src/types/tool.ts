import type { Timestamped, Identified } from "./common.js";

export type ToolId = string & { readonly __brand: unique symbol };

export enum ToolType {
  Search = "search",
  Calculator = "calculator",
  CodeExecutor = "code_executor",
  FileOperation = "file_operation",
  Database = "database",
  ApiClient = "api_client",
  Browser = "browser",
  Shell = "shell",
  Transformer = "transformer",
  Validator = "validator",
  Generator = "generator",
  Analyzer = "analyzer",
  MCP = "mcp",
  Plugin = "plugin",
}

export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required: boolean;
  defaultValue: unknown;
  enum: string[] | null;
}

export interface Tool extends Identified, Timestamped {
  name: string;
  type: ToolType;
  description: string;
  parameters: ToolParameter[];
  returnType: string;
  returnDescription: string;
  version: string;
  deprecated: boolean;
  deprecationMessage: string | null;
  examples: ToolExample[];
}

export interface ToolExample {
  input: Record<string, unknown>;
  output: unknown;
  description: string;
}

export interface ToolResult {
  toolId: ToolId;
  success: boolean;
  data: unknown;
  error: string | null;
  executionTimeMs: number;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface ToolConfig {
  toolId: ToolId;
  enabled: boolean;
  maxConcurrentExecutions: number;
  timeoutMs: number;
  retryCount: number;
  retryDelayMs: number;
  parameters: Record<string, unknown>;
  rateLimitRpm: number;
}

export enum ToolPermission {
  Read = "read",
  Write = "write",
  Execute = "execute",
  Network = "network",
  FileSystem = "file_system",
  Database = "database",
  Admin = "admin",
}

export interface ToolAccessControl {
  toolId: ToolId;
  permissions: ToolPermission[];
  allowedRoles: string[];
  restrictedOperations: string[];
  requiresApproval: boolean;
  auditLog: boolean;
}

export enum MCPTransportType {
  Stdio = "stdio",
  SSE = "sse",
  WebSocket = "websocket",
  HTTP = "http",
}

export interface MCPTransportConfig {
  type: MCPTransportType;
  command: string | null;
  args: string[];
  url: string | null;
  headers: Record<string, string>;
  env: Record<string, string>;
  restartOnFailure: boolean;
  maxRestartAttempts: number;
  restartDelayMs: number;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  transport: MCPTransportConfig;
  toolIds: ToolId[];
  capabilities: string[];
  version: string;
  enabled: boolean;
}

export interface MCPConfig {
  servers: MCPServerConfig[];
  defaultTimeoutMs: number;
  maxConcurrentConnections: number;
  connectionPoolSize: number;
  healthCheckIntervalMs: number;
}

export interface PluginDependency {
  pluginId: string;
  version: string;
  optional: boolean;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  main: string;
  tools: ToolId[];
  dependencies: PluginDependency[];
  permissions: ToolPermission[];
  configSchema: Record<string, unknown>;
  minAppVersion: string;
  maxAppVersion: string | null;
}

export interface PluginConfig {
  pluginId: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  priority: number;
  toolOverrides: Record<ToolId, ToolConfig>;
}
