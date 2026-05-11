export const APP_NAME = 'Paracosm';
export const APP_VERSION = '0.1.0';
export const APP_DESCRIPTION = 'Multi-agent AI orchestration framework';
export const DEFAULT_PORT = 3000;
export const DEFAULT_HOST = '0.0.0.0';
export const DEFAULT_API_PREFIX = '/api/v1';
export const MAX_CONCURRENT_SESSIONS = 100;
export const MAX_SESSION_DURATION_MS = 3600000;
export const SESSION_IDLE_TIMEOUT_MS = 1800000;
export const MAX_TOKEN_BUDGET = 1000000;
export const DEFAULT_TOKEN_BUDGET = 100000;
export const TOKEN_BUDGET_WARNING_THRESHOLD = 0.8;
export const TOKEN_BUDGET_CRITICAL_THRESHOLD = 0.95;
export const MAX_ITERATIONS = 50;
export const DEFAULT_MAX_ITERATIONS = 10;
export const DEFAULT_CSE_PHASES = [
    'CONSTRUCT',
    'SIMULATE',
    'EXECUTE',
    'REFLECT',
    'EVOLVE',
];
export const EVENT_BUS_MAX_LISTENERS = 100;
export const EVENT_BUS_HISTORY_SIZE = 1000;
export const PIPELINE_MAX_RETRIES = 3;
export const PIPELINE_RETRY_DELAY_MS = 1000;
export const PIPELINE_BACKOFF_MULTIPLIER = 2;
//# sourceMappingURL=app.js.map