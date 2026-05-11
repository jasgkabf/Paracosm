export const PROVIDER_OPENAI = 'openai' as const;
export const PROVIDER_ANTHROPIC = 'anthropic' as const;
export const PROVIDER_GOOGLE = 'google' as const;
export const PROVIDER_DEEPSEEK = 'deepseek' as const;
export const PROVIDER_MOONSHOT = 'moonshot' as const;
export const PROVIDER_OLLAMA = 'ollama' as const;
export const PROVIDER_LMSTUDIO = 'lmstudio' as const;
export const PROVIDER_VLLM = 'vllm' as const;
export const PROVIDER_CUSTOM = 'custom' as const;

export type LlmProviderId =
  | typeof PROVIDER_OPENAI
  | typeof PROVIDER_ANTHROPIC
  | typeof PROVIDER_GOOGLE
  | typeof PROVIDER_DEEPSEEK
  | typeof PROVIDER_MOONSHOT
  | typeof PROVIDER_OLLAMA
  | typeof PROVIDER_LMSTUDIO
  | typeof PROVIDER_VLLM
  | typeof PROVIDER_CUSTOM;

export const DEFAULT_TIMEOUTS: Record<LlmProviderId, number> = {
  [PROVIDER_OPENAI]: 30000,
  [PROVIDER_ANTHROPIC]: 60000,
  [PROVIDER_GOOGLE]: 45000,
  [PROVIDER_DEEPSEEK]: 30000,
  [PROVIDER_MOONSHOT]: 30000,
  [PROVIDER_OLLAMA]: 120000,
  [PROVIDER_LMSTUDIO]: 120000,
  [PROVIDER_VLLM]: 120000,
  [PROVIDER_CUSTOM]: 60000,
} as const;

export const MAX_RETRIES: Record<LlmProviderId, number> = {
  [PROVIDER_OPENAI]: 3,
  [PROVIDER_ANTHROPIC]: 3,
  [PROVIDER_GOOGLE]: 3,
  [PROVIDER_DEEPSEEK]: 3,
  [PROVIDER_MOONSHOT]: 2,
  [PROVIDER_OLLAMA]: 2,
  [PROVIDER_LMSTUDIO]: 2,
  [PROVIDER_VLLM]: 2,
  [PROVIDER_CUSTOM]: 2,
} as const;

export const PROVIDER_ENDPOINTS: Record<LlmProviderId, string> = {
  [PROVIDER_OPENAI]: 'https://api.openai.com/v1',
  [PROVIDER_ANTHROPIC]: 'https://api.anthropic.com/v1',
  [PROVIDER_GOOGLE]: 'https://generativelanguage.googleapis.com/v1beta',
  [PROVIDER_DEEPSEEK]: 'https://api.deepseek.com/v1',
  [PROVIDER_MOONSHOT]: 'https://api.moonshot.cn/v1',
  [PROVIDER_OLLAMA]: 'http://localhost:11434/api',
  [PROVIDER_LMSTUDIO]: 'http://localhost:1234/v1',
  [PROVIDER_VLLM]: 'http://localhost:8000/v1',
  [PROVIDER_CUSTOM]: '',
} as const;

export const SUPPORTED_AUTH_TYPES = [
  'bearer',
  'basic',
  'api-key',
  'custom',
] as const;

export type SupportedAuthType = (typeof SUPPORTED_AUTH_TYPES)[number];

export const STREAM_FORMATS = [
  'sse',
  'ndjson',
  'websocket',
  'custom',
] as const;

export type StreamFormat = (typeof STREAM_FORMATS)[number];

export const PROVIDER_STREAM_FORMATS: Record<LlmProviderId, StreamFormat> = {
  [PROVIDER_OPENAI]: 'sse',
  [PROVIDER_ANTHROPIC]: 'sse',
  [PROVIDER_GOOGLE]: 'sse',
  [PROVIDER_DEEPSEEK]: 'sse',
  [PROVIDER_MOONSHOT]: 'sse',
  [PROVIDER_OLLAMA]: 'ndjson',
  [PROVIDER_LMSTUDIO]: 'sse',
  [PROVIDER_VLLM]: 'sse',
  [PROVIDER_CUSTOM]: 'sse',
} as const;

export const PROVIDER_AUTH_TYPES: Record<LlmProviderId, SupportedAuthType> = {
  [PROVIDER_OPENAI]: 'bearer',
  [PROVIDER_ANTHROPIC]: 'api-key',
  [PROVIDER_GOOGLE]: 'bearer',
  [PROVIDER_DEEPSEEK]: 'bearer',
  [PROVIDER_MOONSHOT]: 'bearer',
  [PROVIDER_OLLAMA]: 'basic',
  [PROVIDER_LMSTUDIO]: 'basic',
  [PROVIDER_VLLM]: 'bearer',
  [PROVIDER_CUSTOM]: 'custom',
} as const;
