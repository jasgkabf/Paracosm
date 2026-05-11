"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROVIDER_ENDPOINTS = exports.MAX_RETRIES = exports.DEFAULT_TIMEOUTS = exports.PROVIDER_CUSTOM = exports.PROVIDER_LOCAL = exports.PROVIDER_COHERE = exports.PROVIDER_MISTRAL = exports.PROVIDER_GOOGLE = exports.PROVIDER_ANTHROPIC = exports.PROVIDER_OPENAI = void 0;
exports.PROVIDER_OPENAI = 'openai';
exports.PROVIDER_ANTHROPIC = 'anthropic';
exports.PROVIDER_GOOGLE = 'google';
exports.PROVIDER_MISTRAL = 'mistral';
exports.PROVIDER_COHERE = 'cohere';
exports.PROVIDER_LOCAL = 'local';
exports.PROVIDER_CUSTOM = 'custom';
exports.DEFAULT_TIMEOUTS = {
    [exports.PROVIDER_OPENAI]: 30000,
    [exports.PROVIDER_ANTHROPIC]: 60000,
    [exports.PROVIDER_GOOGLE]: 30000,
    [exports.PROVIDER_MISTRAL]: 30000,
    [exports.PROVIDER_COHERE]: 30000,
    [exports.PROVIDER_LOCAL]: 120000,
    [exports.PROVIDER_CUSTOM]: 60000,
};
exports.MAX_RETRIES = {
    [exports.PROVIDER_OPENAI]: 3,
    [exports.PROVIDER_ANTHROPIC]: 3,
    [exports.PROVIDER_GOOGLE]: 3,
    [exports.PROVIDER_MISTRAL]: 3,
    [exports.PROVIDER_COHERE]: 2,
    [exports.PROVIDER_LOCAL]: 5,
    [exports.PROVIDER_CUSTOM]: 3,
};
exports.PROVIDER_ENDPOINTS = {
    [exports.PROVIDER_OPENAI]: 'https://api.openai.com/v1',
    [exports.PROVIDER_ANTHROPIC]: 'https://api.anthropic.com/v1',
    [exports.PROVIDER_GOOGLE]: 'https://generativelanguage.googleapis.com/v1',
    [exports.PROVIDER_MISTRAL]: 'https://api.mistral.ai/v1',
    [exports.PROVIDER_COHERE]: 'https://api.cohere.ai/v1',
    [exports.PROVIDER_LOCAL]: 'http://localhost:11434/v1',
    [exports.PROVIDER_CUSTOM]: '',
};
//# sourceMappingURL=llm-providers.js.map