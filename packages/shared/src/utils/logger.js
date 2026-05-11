"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
exports.formatLogEntry = formatLogEntry;
exports.createLogger = createLogger;
const LOG_LEVEL_PRIORITY = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
};
function formatLogEntry(entry) {
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase().padEnd(5);
    const context = entry.context ? `[${entry.context}]` : '';
    const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
    return `${timestamp} ${level} ${context} ${entry.message}${data}`;
}
class Logger {
    minLevel;
    context;
    handlers;
    constructor(minLevel = 'info', context = '', handlers = []) {
        this.minLevel = minLevel;
        this.context = context;
        this.handlers = handlers;
    }
    shouldLog(level) {
        return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
    }
    log(level, message, data) {
        if (!this.shouldLog(level)) {
            return;
        }
        const entry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            context: this.context || undefined,
            data,
        };
        const formatted = formatLogEntry(entry);
        if (level === 'error' || level === 'fatal') {
            console.error(formatted);
        }
        else if (level === 'warn') {
            console.warn(formatted);
        }
        else {
            console.log(formatted);
        }
        for (const handler of this.handlers) {
            handler(entry);
        }
    }
    debug(message, data) {
        this.log('debug', message, data);
    }
    info(message, data) {
        this.log('info', message, data);
    }
    warn(message, data) {
        this.log('warn', message, data);
    }
    error(message, data) {
        this.log('error', message, data);
    }
    fatal(message, data) {
        this.log('fatal', message, data);
    }
    child(context) {
        const childContext = this.context
            ? `${this.context}:${context}`
            : context;
        return new Logger(this.minLevel, childContext, this.handlers);
    }
    setLevel(level) {
        this.minLevel = level;
    }
    addHandler(handler) {
        this.handlers.push(handler);
    }
}
exports.Logger = Logger;
function createLogger(context, minLevel = 'info') {
    return new Logger(minLevel, context);
}
//# sourceMappingURL=logger.js.map