export declare const TOOL_WEB_SEARCH: "web_search";
export declare const TOOL_FILE_OPERATIONS: "file_operations";
export declare const TOOL_CODE_EXECUTOR: "code_executor";
export declare const TOOL_API_CALLER: "api_caller";
export declare const TOOL_DATA_PROCESSOR: "data_processor";
export declare const TOOL_SHELL_EXECUTOR: "shell_executor";
export declare const TOOL_SYSTEM_INFO: "system_info";
export declare const DEFAULT_TOOL_CONFIG: {
    readonly timeout: 30000;
    readonly retries: 2;
    readonly maxConcurrentCalls: 5;
    readonly rateLimitPerMinute: 60;
    readonly cacheResults: true;
    readonly cacheTtlMs: 300000;
    readonly parameters: {};
    readonly environment: {};
};
export declare const TOOL_PERMISSION_LEVELS: {
    readonly NONE: 0;
    readonly READ: 1;
    readonly WRITE: 2;
    readonly EXECUTE: 3;
    readonly ADMIN: 4;
};
export declare const SANDBOX_DEFAULTS: {
    readonly maxMemoryMB: 512;
    readonly maxCpuTimeMs: 30000;
    readonly maxFileSizeKB: 10240;
    readonly maxOutputLength: 100000;
    readonly allowedCommands: readonly ["ls", "cat", "grep", "find", "wc", "head", "tail", "echo", "sort", "uniq"];
    readonly blockedCommands: readonly ["rm -rf /", "mkfs", "dd", "format", ":(){ :|:& };:"];
    readonly networkAccess: false;
    readonly filesystemAccess: "readonly";
};
export declare const MCP_DEFAULTS: {
    readonly protocol: "stdio";
    readonly reconnect: true;
    readonly reconnectInterval: 5000;
    readonly maxReconnectAttempts: 5;
    readonly requestTimeout: 30000;
    readonly capabilities: readonly [];
};
export declare const PLUGIN_DEFAULTS: {
    readonly maxPlugins: 50;
    readonly verifySignature: true;
    readonly sandboxExecution: true;
    readonly autoUpdate: false;
};
//# sourceMappingURL=tools.d.ts.map