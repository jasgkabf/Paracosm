export const PROVIDER_OPENAI = 'openai' as const;
export const PROVIDER_ANTHROPIC = 'anthropic' as const;
export const PROVIDER_GOOGLE = 'google' as const;
export const PROVIDER_MISTRAL = 'mistral' as const;
export const PROVIDER_COHERE = 'cohere' as const;
export const PROVIDER_LOCAL = 'local' as const;
export const PROVIDER_CUSTOM = 'custom' as const;

export const DEFAULT_TIMEOUTS: Record<string, number> = {
  [PROVIDER_OPENAI]: 30000,
  [PROVIDER_ANTHROPIC]: 60000,
  [PROVIDER_GOOGLE]: 30000,
  [PROVIDER_MISTRAL]: 30000,
  [PROVIDER_COHERE]: 30000,
  [PROVIDER_LOCAL]: 120000,
  [PROVIDER_CUSTOM]: 60000,
};

export const MAX_RETRIES: Record<string, number> = {
  [PROVIDER_OPENAI]: 3,
  [PROVIDER_ANTHROPIC]: 3,
  [PROVIDER_GOOGLE]: 3,
  [PROVIDER_MISTRAL]: 3,
  [PROVIDER_COHERE]: 2,
  [PROVIDER_LOCAL]: 5,
  [PROVIDER_CUSTOM]: 3,
};

export const PROVIDER_ENDPOINTS: Record<string, string> = {
  [PROVIDER_OPENAI]: 'https://api.openai.com/v1',
  [PROVIDER_ANTHROPIC]: 'https://api.anthropic.com/v1',
  [PROVIDER_GOOGLE]: 'https://generativelanguage.googleapis.com/v1',
  [PROVIDER_MISTRAL]: 'https://api.mistral.ai/v1',
  [PROVIDER_COHERE]: 'https://api.cohere.ai/v1',
  [PROVIDER_LOCAL]: 'http://localhost:11434/v1',
  [PROVIDER_CUSTOM]: '',
};
