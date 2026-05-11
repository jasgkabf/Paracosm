export const TOOL_WEB_SEARCH = 'web_search';
export const TOOL_FILE_OPERATIONS = 'file_operations';
export const TOOL_CODE_EXECUTOR = 'code_executor';
export const TOOL_API_CALLER = 'api_caller';
export const TOOL_DATA_PROCESSOR = 'data_processor';
export const TOOL_SHELL_EXECUTOR = 'shell_executor';
export const TOOL_SYSTEM_INFO = 'system_info';
export const DEFAULT_TOOL_CONFIG = {
    timeout: 30000,
    retries: 2,
    maxConcurrentCalls: 5,
    rateLimitPerMinute: 60,
    cacheResults: true,
    cacheTtlMs: 300000,
    parameters: {},
    environment: {},
};
export const TOOL_PERMISSION_LEVELS = {
    NONE: 0,
    READ: 1,
    WRITE: 2,
    EXECUTE: 3,
    ADMIN: 4,
};
export const SANDBOX_DEFAULTS = {
    maxMemoryMB: 512,
    maxCpuTimeMs: 30000,
    maxFileSizeKB: 10240,
    maxOutputLength: 100000,
    allowedCommands: ['ls', 'cat', 'grep', 'find', 'wc', 'head', 'tail', 'echo', 'sort', 'uniq'],
    blockedCommands: ['rm -rf /', 'mkfs', 'dd', 'format', ':(){ :|:& };:'],
    networkAccess: false,
    filesystemAccess: 'readonly',
};
export const MCP_DEFAULTS = {
    protocol: 'stdio',
    reconnect: true,
    reconnectInterval: 5000,
    maxReconnectAttempts: 5,
    requestTimeout: 30000,
    capabilities: [],
};
export const PLUGIN_DEFAULTS = {
    maxPlugins: 50,
    verifySignature: true,
    sandboxExecution: true,
    autoUpdate: false,
};
//# sourceMappingURL=tools.js.map