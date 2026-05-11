import type { Tool, ToolResult, ToolConfig, ToolPermission as ToolPermType, ToolId, ToolType } from '@paracosm/shared';

export interface ToolExecutionContext {
  sessionId: string;
  userId: string;
  permissions: ToolPermType[];
  timeout: number;
  environment: Record<string, string>;
  metadata: Record<string, unknown>;
}

export interface ToolDefinition {
  id: ToolId;
  name: string;
  type: ToolType;
  description: string;
  version: string;
  config: ToolConfig;
  permissions: ToolPermType[];
  handler: (input: unknown, context: ToolExecutionContext) => Promise<ToolResult>;
  validate?: (input: unknown) => string[];
}

export interface SandboxConfig {
  maxMemoryMB: number;
  maxCpuTimeMs: number;
  maxFileSizeKB: number;
  maxOutputLength: number;
  allowedCommands: string[];
  blockedCommands: string[];
  networkAccess: boolean;
  filesystemAccess: 'none' | 'readonly' | 'readwrite';
}

export interface CompositionStep {
  toolId: ToolId;
  inputMapping: Record<string, string>;
  outputKey: string;
  condition?: string;
}

export interface CompositionResult {
  steps: CompositionStep[];
  results: ToolResult[];
  finalOutput: unknown;
  duration: number;
  success: boolean;
}
