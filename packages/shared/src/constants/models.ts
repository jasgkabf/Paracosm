export const MODEL_GPT4O = 'gpt-4o' as const;
export const MODEL_GPT4O_MINI = 'gpt-4o-mini' as const;
export const MODEL_GPT4_TURBO = 'gpt-4-turbo' as const;
export const MODEL_GPT35_TURBO = 'gpt-3.5-turbo' as const;
export const MODEL_CLAUDE_OPUS = 'claude-3-opus-20240229' as const;
export const MODEL_CLAUDE_SONNET = 'claude-3-5-sonnet-20241022' as const;
export const MODEL_CLAUDE_HAIKU = 'claude-3-haiku-20240307' as const;
export const MODEL_GEMINI_PRO = 'gemini-1.5-pro' as const;
export const MODEL_GEMINI_FLASH = 'gemini-1.5-flash' as const;
export const MODEL_MISTRAL_LARGE = 'mistral-large-latest' as const;
export const MODEL_MISTRAL_MEDIUM = 'mistral-medium-latest' as const;
export const MODEL_MISTRAL_SMALL = 'mistral-small-latest' as const;

export interface ModelCapability {
  contextWindow: number;
  maxOutputTokens: number;
  streaming: boolean;
  functionCalling: boolean;
  vision: boolean;
  costPer1kInput: number;
  costPer1kOutput: number;
}

export const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  [MODEL_GPT4O]: {
    contextWindow: 128000,
    maxOutputTokens: 4096,
    streaming: true,
    functionCalling: true,
    vision: true,
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
  },
  [MODEL_GPT4O_MINI]: {
    contextWindow: 128000,
    maxOutputTokens: 4096,
    streaming: true,
    functionCalling: true,
    vision: true,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
  },
  [MODEL_GPT4_TURBO]: {
    contextWindow: 128000,
    maxOutputTokens: 4096,
    streaming: true,
    functionCalling: true,
    vision: true,
    costPer1kInput: 0.01,
    costPer1kOutput: 0.03,
  },
  [MODEL_GPT35_TURBO]: {
    contextWindow: 16385,
    maxOutputTokens: 4096,
    streaming: true,
    functionCalling: true,
    vision: false,
    costPer1kInput: 0.0005,
    costPer1kOutput: 0.0015,
  },
  [MODEL_CLAUDE_OPUS]: {
    contextWindow: 200000,
    maxOutputTokens: 4096,
    streaming: true,
    functionCalling: true,
    vision: true,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
  },
  [MODEL_CLAUDE_SONNET]: {
    contextWindow: 200000,
    maxOutputTokens: 8192,
    streaming: true,
    functionCalling: true,
    vision: true,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
  },
  [MODEL_CLAUDE_HAIKU]: {
    contextWindow: 200000,
    maxOutputTokens: 4096,
    streaming: true,
    functionCalling: true,
    vision: true,
    costPer1kInput: 0.00025,
    costPer1kOutput: 0.00125,
  },
  [MODEL_GEMINI_PRO]: {
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    streaming: true,
    functionCalling: true,
    vision: true,
    costPer1kInput: 0.0035,
    costPer1kOutput: 0.0105,
  },
  [MODEL_GEMINI_FLASH]: {
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    streaming: true,
    functionCalling: true,
    vision: true,
    costPer1kInput: 0.00035,
    costPer1kOutput: 0.00105,
  },
  [MODEL_MISTRAL_LARGE]: {
    contextWindow: 32000,
    maxOutputTokens: 4096,
    streaming: true,
    functionCalling: true,
    vision: false,
    costPer1kInput: 0.008,
    costPer1kOutput: 0.024,
  },
  [MODEL_MISTRAL_MEDIUM]: {
    contextWindow: 32000,
    maxOutputTokens: 4096,
    streaming: true,
    functionCalling: true,
    vision: false,
    costPer1kInput: 0.0027,
    costPer1kOutput: 0.0081,
  },
  [MODEL_MISTRAL_SMALL]: {
    contextWindow: 32000,
    maxOutputTokens: 4096,
    streaming: true,
    functionCalling: true,
    vision: false,
    costPer1kInput: 0.0002,
    costPer1kOutput: 0.0006,
  },
};

export const MODEL_PRICING = Object.fromEntries(
  Object.entries(MODEL_CAPABILITIES).map(([model, cap]) => [
    model,
    {
      inputPer1k: cap.costPer1kInput,
      outputPer1k: cap.costPer1kOutput,
    },
  ]),
);
