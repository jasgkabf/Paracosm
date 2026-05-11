export const APP_NAME = 'Paracosm' as const;
export const APP_VERSION = '0.1.0' as const;
export const DEFAULT_PORT = 7529 as const;
export const WEBSOCKET_PATH = '/ws' as const;
export const API_PREFIX = '/api/v1' as const;
export const DEFAULT_HOST = '0.0.0.0' as const;
export const HEARTBEAT_INTERVAL_MS = 1000 as const;
export const MAX_CONTEXT_WINDOW = 200000 as const;
export const DEFAULT_TEMPERATURE = 0.7 as const;
export const DEFAULT_MAX_TOKENS = 4096 as const;

export const MAX_REQUEST_SIZE_BYTES = 10485760 as const;
export const MAX_CONCURRENT_SESSIONS = 100 as const;
export const SESSION_IDLE_TIMEOUT_MS = 1800000 as const;
export const REQUEST_ID_HEADER = 'x-request-id' as const;
export const CORRELATION_ID_HEADER = 'x-correlation-id' as const;

export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
export const DEFAULT_LOG_LEVEL: LogLevel = 'info';

export const ENV_DEVELOPMENT = 'development' as const;
export const ENV_PRODUCTION = 'production' as const;
export const ENV_TEST = 'test' as const;
export type AppEnvironment = typeof ENV_DEVELOPMENT | typeof ENV_PRODUCTION | typeof ENV_TEST;
