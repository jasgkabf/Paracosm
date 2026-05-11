export type LLMProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'mistral'
  | 'cohere'
  | 'deepseek'
  | 'moonshot'
  | 'ollama'
  | 'lmstudio'
  | 'vllm'
  | 'local'
  | 'custom';

export type LLMModel = string;

export interface LLMRequest {
  id: string;
  model: LLMModel;
  provider: LLMProvider;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export interface LLMResponse {
  id: string;
  requestId: string;
  content: string;
  model: LLMModel;
  provider: LLMProvider;
  finishReason: string;
  usage: TokenUsage;
  latencyMs: number;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export interface LLMStreamChunk {
  id: string;
  requestId: string;
  content: string;
  delta: string;
  model: LLMModel;
  provider: LLMProvider;
  finishReason: string | null;
  usage?: Partial<TokenUsage>;
  timestamp: Date;
}

export interface LLMConfig {
  defaultProvider: LLMProvider;
  defaultModel: LLMModel;
  providers: ProviderConfig[];
  routing: RoutingStrategy;
  budget: BudgetConfig;
  fallback: FallbackConfig;
  retries: number;
  timeout: number;
  metadata: Record<string, unknown>;
}

export interface ProviderConfig {
  provider: LLMProvider;
  apiKey: string;
  baseUrl?: string;
  models: LLMModel[];
  defaultModel: LLMModel;
  maxConcurrentRequests: number;
  timeout: number;
  retries: number;
  metadata: Record<string, unknown>;
}

export interface RoutingRule {
  id: string;
  name: string;
  condition: string;
  provider: LLMProvider;
  model: LLMModel;
  priority: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
}

export type RoutingStrategy =
  | 'round_robin'
  | 'least_latency'
  | 'cost_optimized'
  | 'quality_optimized'
  | 'adaptive'
  | 'manual';

export interface BudgetConfig {
  dailyLimit: number;
  monthlyLimit: number;
  perRequestLimit: number;
  alertThreshold: number;
  currency: string;
}

export interface FallbackConfig {
  enabled: boolean;
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  fallbackProviders: LLMProvider[];
  fallbackModels: LLMModel[];
}

export interface ProviderHealth {
  provider: LLMProvider;
  isAvailable: boolean;
  latencyMs: number;
  errorRate: number;
  successRate: number;
  lastChecked: Date;
  consecutiveErrors: number;
  totalRequests: number;
  totalErrors: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CustomProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  headers: Record<string, string>;
  requestMapping: RequestMapping;
  responseMapping: ResponseMapping;
  supportedModels: LLMModel[];
  metadata: Record<string, unknown>;
}

export interface RequestMapping {
  promptField: string;
  systemPromptField: string;
  modelField: string;
  temperatureField: string;
  maxTokensField: string;
  topPField: string;
  stopSequencesField: string;
  extraFields: Record<string, unknown>;
}

export interface ResponseMapping {
  contentField: string;
  modelField: string;
  finishReasonField: string;
  usageField: string;
  promptTokensField: string;
  completionTokensField: string;
  totalTokensField: string;
  errorField: string;
  errorMessageField: string;
}

export interface ProviderTemplate {
  id: string;
  name: string;
  provider: LLMProvider;
  requestMapping: RequestMapping;
  responseMapping: ResponseMapping;
  streamMapping: Partial<ResponseMapping>;
  capabilities: CapabilityDeclaration;
  metadata: Record<string, unknown>;
}

export interface CapabilityDeclaration {
  streaming: boolean;
  functionCalling: boolean;
  vision: boolean;
  audio: boolean;
  embeddings: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
  supportedLanguages: string[];
}
