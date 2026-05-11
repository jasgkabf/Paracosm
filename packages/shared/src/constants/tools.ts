export const TOOL_WEB_SEARCH = 'web_search' as const;
export const TOOL_FILE_OPS = 'file_ops' as const;
export const TOOL_CODE_EXEC = 'code_exec' as const;
export const TOOL_API_CALLER = 'api_caller' as const;
export const TOOL_DATA_PROCESSOR = 'data_processor' as const;
export const TOOL_SHELL_EXEC = 'shell_exec' as const;
export const TOOL_SYSTEM_INFO = 'system_info' as const;

export type ToolId =
  | typeof TOOL_WEB_SEARCH
  | typeof TOOL_FILE_OPS
  | typeof TOOL_CODE_EXEC
  | typeof TOOL_API_CALLER
  | typeof TOOL_DATA_PROCESSOR
  | typeof TOOL_SHELL_EXEC
  | typeof TOOL_SYSTEM_INFO;

export const TOOL_PERMISSIONS: Record<ToolId, 'safe' | 'caution' | 'dangerous'> = {
  [TOOL_WEB_SEARCH]: 'safe',
  [TOOL_FILE_OPS]: 'caution',
  [TOOL_CODE_EXEC]: 'dangerous',
  [TOOL_API_CALLER]: 'caution',
  [TOOL_DATA_PROCESSOR]: 'safe',
  [TOOL_SHELL_EXEC]: 'dangerous',
  [TOOL_SYSTEM_INFO]: 'safe',
} as const;

export type ToolPermissionLevel = 'safe' | 'caution' | 'dangerous';

export const TOOL_CATEGORIES = [
  'information',
  'file',
  'code',
  'network',
  'system',
  'data',
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const TOOL_CATEGORY_MAP: Record<ToolId, ToolCategory> = {
  [TOOL_WEB_SEARCH]: 'information',
  [TOOL_FILE_OPS]: 'file',
  [TOOL_CODE_EXEC]: 'code',
  [TOOL_API_CALLER]: 'network',
  [TOOL_DATA_PROCESSOR]: 'data',
  [TOOL_SHELL_EXEC]: 'system',
  [TOOL_SYSTEM_INFO]: 'system',
} as const;

export const PERMISSION_LEVEL_ORDER: Record<ToolPermissionLevel, number> = {
  safe: 0,
  caution: 1,
  dangerous: 2,
} as const;

export const DEFAULT_ALLOWED_TOOLS: readonly ToolId[] = [
  TOOL_WEB_SEARCH,
  TOOL_DATA_PROCESSOR,
  TOOL_SYSTEM_INFO,
] as const;

export const CAUTION_TOOLS: readonly ToolId[] = [
  TOOL_FILE_OPS,
  TOOL_API_CALLER,
] as const;

export const DANGEROUS_TOOLS: readonly ToolId[] = [
  TOOL_CODE_EXEC,
  TOOL_SHELL_EXEC,
] as const;

export const TOOL_EXECUTION_TIMEOUT_MS = 30000 as const;
export const TOOL_MAX_RETRIES = 2 as const;
