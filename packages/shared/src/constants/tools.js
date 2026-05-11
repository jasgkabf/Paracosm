"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLUGIN_DEFAULTS = exports.MCP_DEFAULTS = exports.SANDBOX_DEFAULTS = exports.TOOL_PERMISSION_LEVELS = exports.DEFAULT_TOOL_CONFIG = exports.TOOL_SYSTEM_INFO = exports.TOOL_SHELL_EXECUTOR = exports.TOOL_DATA_PROCESSOR = exports.TOOL_API_CALLER = exports.TOOL_CODE_EXECUTOR = exports.TOOL_FILE_OPERATIONS = exports.TOOL_WEB_SEARCH = void 0;
exports.TOOL_WEB_SEARCH = 'web_search';
exports.TOOL_FILE_OPERATIONS = 'file_operations';
exports.TOOL_CODE_EXECUTOR = 'code_executor';
exports.TOOL_API_CALLER = 'api_caller';
exports.TOOL_DATA_PROCESSOR = 'data_processor';
exports.TOOL_SHELL_EXECUTOR = 'shell_executor';
exports.TOOL_SYSTEM_INFO = 'system_info';
exports.DEFAULT_TOOL_CONFIG = {
    timeout: 30000,
    retries: 2,
    maxConcurrentCalls: 5,
    rateLimitPerMinute: 60,
    cacheResults: true,
    cacheTtlMs: 300000,
    parameters: {},
    environment: {},
};
exports.TOOL_PERMISSION_LEVELS = {
    NONE: 0,
    READ: 1,
    WRITE: 2,
    EXECUTE: 3,
    ADMIN: 4,
};
exports.SANDBOX_DEFAULTS = {
    maxMemoryMB: 512,
    maxCpuTimeMs: 30000,
    maxFileSizeKB: 10240,
    maxOutputLength: 100000,
    allowedCommands: ['ls', 'cat', 'grep', 'find', 'wc', 'head', 'tail', 'echo', 'sort', 'uniq'],
    blockedCommands: ['rm -rf /', 'mkfs', 'dd', 'format', ':(){ :|:& };:'],
    networkAccess: false,
    filesystemAccess: 'readonly',
};
exports.MCP_DEFAULTS = {
    protocol: 'stdio',
    reconnect: true,
    reconnectInterval: 5000,
    maxReconnectAttempts: 5,
    requestTimeout: 30000,
    capabilities: [],
};
exports.PLUGIN_DEFAULTS = {
    maxPlugins: 50,
    verifySignature: true,
    sandboxExecution: true,
    autoUpdate: false,
};
//# sourceMappingURL=tools.js.map