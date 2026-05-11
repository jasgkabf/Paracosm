export const MODEL_GPT4O = 'gpt-4o' as const;
export const MODEL_GPT4O_MINI = 'gpt-4o-mini' as const;
export const MODEL_GPT4_TURBO = 'gpt-4-turbo' as const;

export const MODEL_CLAUDE_SONNET = 'claude-sonnet-4-20250514' as const;
export const MODEL_CLAUDE_HAIKU = 'claude-haiku-3-5-20241022' as const;

export const MODEL_GEMINI_PRO = 'gemini-1.5-pro' as const;
export const MODEL_GEMINI_FLASH = 'gemini-1.5-flash' as const;

export const MODEL_DEEPSEEK_V3 = 'deepseek-v3' as const;
export const MODEL_DEEPSEEK_CHAT = 'deepseek-chat' as const;

export const MODEL_LLAMA3_8B = 'llama3-8b' as const;
export const MODEL_LLAMA3_70B = 'llama3-70b' as const;

export type ModelId =
  | typeof MODEL_GPT4O
  | typeof MODEL_GPT4O_MINI
  | typeof MODEL_GPT4_TURBO
  | typeof MODEL_CLAUDE_SONNET
  | typeof MODEL_CLAUDE_HAIKU
  | typeof MODEL_GEMINI_PRO
  | typeof MODEL_GEMINI_FLASH
  | typeof MODEL_DEEPSEEK_V3
  | typeof MODEL_DEEPSEEK_CHAT
  | typeof MODEL_LLAMA3_8B
  | typeof MODEL_LLAMA3_70B;

export interface ModelCapabilities {
  contextWindow: number;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
  maxOutputTokens: number;
}

export const MODEL_CAPABILITIES: Record<ModelId, ModelCapabilities> = {
  [MODEL_GPT4O]: {
    contextWindow: 128000,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    maxOutputTokens: 16384,
  },
  [MODEL_GPT4O_MINI]: {
    contextWindow: 128000,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    maxOutputTokens: 16384,
  },
  [MODEL_GPT4_TURBO]: {
    contextWindow: 128000,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    maxOutputTokens: 4096,
  },
  [MODEL_CLAUDE_SONNET]: {
    contextWindow: 200000,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    maxOutputTokens: 8192,
  },
  [MODEL_CLAUDE_HAIKU]: {
    contextWindow: 200000,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    maxOutputTokens: 8192,
  },
  [MODEL_GEMINI_PRO]: {
    contextWindow: 2097152,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    maxOutputTokens: 8192,
  },
  [MODEL_GEMINI_FLASH]: {
    contextWindow: 1048576,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    maxOutputTokens: 8192,
  },
  [MODEL_DEEPSEEK_V3]: {
    contextWindow: 128000,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsVision: false,
    maxOutputTokens: 8192,
  },
  [MODEL_DEEPSEEK_CHAT]: {
    contextWindow: 64000,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsVision: false,
    maxOutputTokens: 4096,
  },
  [MODEL_LLAMA3_8B]: {
    contextWindow: 8192,
    supportsStreaming: true,
    supportsFunctionCalling: false,
    supportsVision: false,
    maxOutputTokens: 4096,
  },
  [MODEL_LLAMA3_70B]: {
    contextWindow: 8192,
    supportsStreaming: true,
    supportsFunctionCalling: false,
    supportsVision: false,
    maxOutputTokens: 4096,
  },
} as const;

export interface ModelPricing {
  inputPer1K: number;
  outputPer1K: number;
}

export const MODEL_PRICING: Record<ModelId, ModelPricing> = {
  [MODEL_GPT4O]: {
    inputPer1K: 0.005,
    outputPer1K: 0.015,
  },
  [MODEL_GPT4O_MINI]: {
    inputPer1K: 0.00015,
    outputPer1K: 0.0006,
  },
  [MODEL_GPT4_TURBO]: {
    inputPer1K: 0.01,
    outputPer1K: 0.03,
  },
  [MODEL_CLAUDE_SONNET]: {
    inputPer1K: 0.003,
    outputPer1K: 0.015,
  },
  [MODEL_CLAUDE_HAIKU]: {
    inputPer1K: 0.00025,
    outputPer1K: 0.00125,
  },
  [MODEL_GEMINI_PRO]: {
    inputPer1K: 0.00125,
    outputPer1K: 0.005,
  },
  [MODEL_GEMINI_FLASH]: {
    inputPer1K: 0.000075,
    outputPer1K: 0.0003,
  },
  [MODEL_DEEPSEEK_V3]: {
    inputPer1K: 0.00027,
    outputPer1K: 0.0011,
  },
  [MODEL_DEEPSEEK_CHAT]: {
    inputPer1K: 0.00014,
    outputPer1K: 0.00028,
  },
  [MODEL_LLAMA3_8B]: {
    inputPer1K: 0,
    outputPer1K: 0,
  },
  [MODEL_LLAMA3_70B]: {
    inputPer1K: 0,
    outputPer1K: 0,
  },
} as const;

export const OPENAI_MODELS = [MODEL_GPT4O, MODEL_GPT4O_MINI, MODEL_GPT4_TURBO] as const;
export const ANTHROPIC_MODELS = [MODEL_CLAUDE_SONNET, MODEL_CLAUDE_HAIKU] as const;
export const GOOGLE_MODELS = [MODEL_GEMINI_PRO, MODEL_GEMINI_FLASH] as const;
export const DEEPSEEK_MODELS = [MODEL_DEEPSEEK_V3, MODEL_DEEPSEEK_CHAT] as const;
export const LOCAL_MODELS = [MODEL_LLAMA3_8B, MODEL_LLAMA3_70B] as const;

export const VISION_CAPABLE_MODELS: readonly ModelId[] = [
  MODEL_GPT4O,
  MODEL_GPT4O_MINI,
  MODEL_GPT4_TURBO,
  MODEL_CLAUDE_SONNET,
  MODEL_CLAUDE_HAIKU,
  MODEL_GEMINI_PRO,
  MODEL_GEMINI_FLASH,
] as const;

export const FUNCTION_CALLING_MODELS: readonly ModelId[] = [
  MODEL_GPT4O,
  MODEL_GPT4O_MINI,
  MODEL_GPT4_TURBO,
  MODEL_CLAUDE_SONNET,
  MODEL_CLAUDE_HAIKU,
  MODEL_GEMINI_PRO,
  MODEL_GEMINI_FLASH,
  MODEL_DEEPSEEK_V3,
  MODEL_DEEPSEEK_CHAT,
] as const;
