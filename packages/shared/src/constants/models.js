"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_PRICING = exports.MODEL_CAPABILITIES = exports.MODEL_MISTRAL_SMALL = exports.MODEL_MISTRAL_MEDIUM = exports.MODEL_MISTRAL_LARGE = exports.MODEL_GEMINI_FLASH = exports.MODEL_GEMINI_PRO = exports.MODEL_CLAUDE_HAIKU = exports.MODEL_CLAUDE_SONNET = exports.MODEL_CLAUDE_OPUS = exports.MODEL_GPT35_TURBO = exports.MODEL_GPT4_TURBO = exports.MODEL_GPT4O_MINI = exports.MODEL_GPT4O = void 0;
exports.MODEL_GPT4O = 'gpt-4o';
exports.MODEL_GPT4O_MINI = 'gpt-4o-mini';
exports.MODEL_GPT4_TURBO = 'gpt-4-turbo';
exports.MODEL_GPT35_TURBO = 'gpt-3.5-turbo';
exports.MODEL_CLAUDE_OPUS = 'claude-3-opus-20240229';
exports.MODEL_CLAUDE_SONNET = 'claude-3-5-sonnet-20241022';
exports.MODEL_CLAUDE_HAIKU = 'claude-3-haiku-20240307';
exports.MODEL_GEMINI_PRO = 'gemini-1.5-pro';
exports.MODEL_GEMINI_FLASH = 'gemini-1.5-flash';
exports.MODEL_MISTRAL_LARGE = 'mistral-large-latest';
exports.MODEL_MISTRAL_MEDIUM = 'mistral-medium-latest';
exports.MODEL_MISTRAL_SMALL = 'mistral-small-latest';
exports.MODEL_CAPABILITIES = {
    [exports.MODEL_GPT4O]: {
        contextWindow: 128000,
        maxOutputTokens: 4096,
        streaming: true,
        functionCalling: true,
        vision: true,
        costPer1kInput: 0.005,
        costPer1kOutput: 0.015,
    },
    [exports.MODEL_GPT4O_MINI]: {
        contextWindow: 128000,
        maxOutputTokens: 4096,
        streaming: true,
        functionCalling: true,
        vision: true,
        costPer1kInput: 0.00015,
        costPer1kOutput: 0.0006,
    },
    [exports.MODEL_GPT4_TURBO]: {
        contextWindow: 128000,
        maxOutputTokens: 4096,
        streaming: true,
        functionCalling: true,
        vision: true,
        costPer1kInput: 0.01,
        costPer1kOutput: 0.03,
    },
    [exports.MODEL_GPT35_TURBO]: {
        contextWindow: 16385,
        maxOutputTokens: 4096,
        streaming: true,
        functionCalling: true,
        vision: false,
        costPer1kInput: 0.0005,
        costPer1kOutput: 0.0015,
    },
    [exports.MODEL_CLAUDE_OPUS]: {
        contextWindow: 200000,
        maxOutputTokens: 4096,
        streaming: true,
        functionCalling: true,
        vision: true,
        costPer1kInput: 0.015,
        costPer1kOutput: 0.075,
    },
    [exports.MODEL_CLAUDE_SONNET]: {
        contextWindow: 200000,
        maxOutputTokens: 8192,
        streaming: true,
        functionCalling: true,
        vision: true,
        costPer1kInput: 0.003,
        costPer1kOutput: 0.015,
    },
    [exports.MODEL_CLAUDE_HAIKU]: {
        contextWindow: 200000,
        maxOutputTokens: 4096,
        streaming: true,
        functionCalling: true,
        vision: true,
        costPer1kInput: 0.00025,
        costPer1kOutput: 0.00125,
    },
    [exports.MODEL_GEMINI_PRO]: {
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        streaming: true,
        functionCalling: true,
        vision: true,
        costPer1kInput: 0.0035,
        costPer1kOutput: 0.0105,
    },
    [exports.MODEL_GEMINI_FLASH]: {
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        streaming: true,
        functionCalling: true,
        vision: true,
        costPer1kInput: 0.00035,
        costPer1kOutput: 0.00105,
    },
    [exports.MODEL_MISTRAL_LARGE]: {
        contextWindow: 32000,
        maxOutputTokens: 4096,
        streaming: true,
        functionCalling: true,
        vision: false,
        costPer1kInput: 0.008,
        costPer1kOutput: 0.024,
    },
    [exports.MODEL_MISTRAL_MEDIUM]: {
        contextWindow: 32000,
        maxOutputTokens: 4096,
        streaming: true,
        functionCalling: true,
        vision: false,
        costPer1kInput: 0.0027,
        costPer1kOutput: 0.0081,
    },
    [exports.MODEL_MISTRAL_SMALL]: {
        contextWindow: 32000,
        maxOutputTokens: 4096,
        streaming: true,
        functionCalling: true,
        vision: false,
        costPer1kInput: 0.0002,
        costPer1kOutput: 0.0006,
    },
};
exports.MODEL_PRICING = Object.fromEntries(Object.entries(exports.MODEL_CAPABILITIES).map(([model, cap]) => [
    model,
    {
        inputPer1k: cap.costPer1kInput,
        outputPer1k: cap.costPer1kOutput,
    },
]));
//# sourceMappingURL=models.js.map