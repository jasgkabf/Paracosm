export const PROVIDER_OPENAI = 'openai';
export const PROVIDER_ANTHROPIC = 'anthropic';
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_MISTRAL = 'mistral';
export const PROVIDER_COHERE = 'cohere';
export const PROVIDER_LOCAL = 'local';
export const PROVIDER_CUSTOM = 'custom';
export const DEFAULT_TIMEOUTS = {
    [PROVIDER_OPENAI]: 30000,
    [PROVIDER_ANTHROPIC]: 60000,
    [PROVIDER_GOOGLE]: 30000,
    [PROVIDER_MISTRAL]: 30000,
    [PROVIDER_COHERE]: 30000,
    [PROVIDER_LOCAL]: 120000,
    [PROVIDER_CUSTOM]: 60000,
};
export const MAX_RETRIES = {
    [PROVIDER_OPENAI]: 3,
    [PROVIDER_ANTHROPIC]: 3,
    [PROVIDER_GOOGLE]: 3,
    [PROVIDER_MISTRAL]: 3,
    [PROVIDER_COHERE]: 2,
    [PROVIDER_LOCAL]: 5,
    [PROVIDER_CUSTOM]: 3,
};
export const PROVIDER_ENDPOINTS = {
    [PROVIDER_OPENAI]: 'https://api.openai.com/v1',
    [PROVIDER_ANTHROPIC]: 'https://api.anthropic.com/v1',
    [PROVIDER_GOOGLE]: 'https://generativelanguage.googleapis.com/v1',
    [PROVIDER_MISTRAL]: 'https://api.mistral.ai/v1',
    [PROVIDER_COHERE]: 'https://api.cohere.ai/v1',
    [PROVIDER_LOCAL]: 'http://localhost:11434/v1',
    [PROVIDER_CUSTOM]: '',
};
//# sourceMappingURL=llm-providers.js.map