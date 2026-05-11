import type {
  Tool,
  ToolResult,
  ToolConfig,
  ToolPermission,
  ToolAccessControl,
  MCPServerConfig,
  MCPTransportConfig,
  PluginManifest,
  PluginConfig,
} from "@paracosm/shared";
import type { Result } from "@paracosm/shared";

export interface ToolExecutionContext {
  sessionId: string;
  userId: string;
  roles: string[];
  permissions: ToolPermission[];
  metadata: Record<string, unknown>;
  parentExecutionId: string | null;
  timeout: number;
  sandboxed: boolean;
  maxRetries: number;
}

export interface ToolExecutionResult {
  executionId: string;
  toolId: string;
  success: boolean;
  data: unknown;
  error: string | null;
  executionTimeMs: number;
  memoryUsedBytes: number;
  cpuTimeMs: number;
  retries: number;
  timestamp: string;
}

export interface ToolInternal extends Tool {
  execute: (params: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
  validate: (params: Record<string, unknown>) => boolean;
  dependencies: string[];
  category: string;
  permissionLevel: "safe" | "caution" | "dangerous";
  rateLimitPerMinute: number;
  maxConcurrentExecutions: number;
  requiresSandbox: boolean;
}

export interface PermissionPolicy {
  toolId: string;
  allowedRoles: string[];
  deniedRoles: string[];
  maxExecutionTimeMs: number;
  maxRetries: number;
  requireApproval: boolean;
  auditEnabled: boolean;
  sandboxRequired: boolean;
  customRules: Record<string, unknown>;
}

export interface ToolChain {
  id: string;
  name: string;
  description: string;
  steps: ChainStep[];
  parallelGroups: string[][];
  fallbackStrategy: "skip" | "abort" | "retry" | "alternative";
  maxTotalTimeMs: number;
}

export interface ChainStep {
  id: string;
  toolId: string;
  inputMapping: Record<string, string>;
  outputMapping: Record<string, string>;
  condition: string | null;
  timeout: number;
  retries: number;
  dependsOn: string[];
}

export interface ComposedTool {
  id: string;
  name: string;
  description: string;
  chain: ToolChain;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

export interface PluginState {
  id: string;
  manifest: PluginManifest;
  config: PluginConfig;
  status: "loaded" | "active" | "error" | "unloaded";
  loadedAt: string;
  errorCount: number;
  lastError: string | null;
  sandboxId: string | null;
}

export interface MCPConnection {
  id: string;
  serverConfig: MCPServerConfig;
  status: "disconnected" | "connecting" | "connected" | "error";
  connectedAt: string | null;
  lastPingAt: string | null;
  errorCount: number;
  lastError: string | null;
  toolsAvailable: string[];
}

export interface SandboxConfig {
  maxMemoryBytes: number;
  maxCpuTimeMs: number;
  maxExecutionTimeMs: number;
  maxFileSizeBytes: number;
  allowNetwork: boolean;
  allowFileSystem: boolean;
  allowSubprocess: boolean;
  environmentVariables: Record<string, string>;
  allowedModules: string[];
  blockedModules: string[];
}

export interface SandboxStats {
  sandboxId: string;
  memoryUsedBytes: number;
  cpuTimeMs: number;
  executionTimeMs: number;
  fileOperations: number;
  networkRequests: number;
  subprocessCount: number;
  isOverLimit: boolean;
}

export interface ExecutionReport {
  executionId: string;
  toolId: string;
  status: "success" | "failure" | "timeout" | "permission_denied" | "validation_error";
  startTime: string;
  endTime: string;
  durationMs: number;
  memoryUsedBytes: number;
  cpuTimeMs: number;
  retries: number;
  error: string | null;
  metadata: Record<string, unknown>;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  toolId: string;
  userId: string;
  action: "grant" | "revoke" | "escalate" | "deny" | "check";
  permission: ToolPermission;
  result: "allowed" | "denied" | "escalated";
  reason: string;
  context: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PermissionResult {
  allowed: boolean;
  permission: ToolPermission;
  reason: string;
  requiresEscalation: boolean;
  escalationTarget: string | null;
}

export type { Tool, ToolResult, ToolConfig, ToolPermission, ToolAccessControl };
