export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    context?: string;
    data?: Record<string, unknown>;
}
export declare function formatLogEntry(entry: LogEntry): string;
export declare class Logger {
    private minLevel;
    private context;
    private handlers;
    constructor(minLevel?: LogLevel, context?: string, handlers?: Array<(entry: LogEntry) => void>);
    private shouldLog;
    private log;
    debug(message: string, data?: Record<string, unknown>): void;
    info(message: string, data?: Record<string, unknown>): void;
    warn(message: string, data?: Record<string, unknown>): void;
    error(message: string, data?: Record<string, unknown>): void;
    fatal(message: string, data?: Record<string, unknown>): void;
    child(context: string): Logger;
    setLevel(level: LogLevel): void;
    addHandler(handler: (entry: LogEntry) => void): void;
}
export declare function createLogger(context: string, minLevel?: LogLevel): Logger;
//# sourceMappingURL=logger.d.ts.map