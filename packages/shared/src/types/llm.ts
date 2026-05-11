import type { Timestamped, Identified } from "./common.js";

export type LLMProviderId = string & { readonly __brand: unique symbol };

export enum LLMProvider {
  OpenAI = "openai",
  Anthropic = "anthropic",
  Google = "google",
  Mistral = "mistral",
  Cohere = "cohere",
  Local = "local",
  Custom = "custom",
}

export type LLMModelId = string & { readonly __brand: unique symbol };

export interface LLMModelCapabilities {
  streaming: boolean;
  functionCalling: boolean;
  jsonMode: boolean;
  vision: boolean;
  audio: boolean;
  embeddings: boolean;
  maxTokens: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  supportedLanguages: string[];
  fineTuning: boolean;
  systemPrompt: boolean;
  multiTurn: boolean;
}

export interface LLMModel extends Identified {
  providerId: LLMProviderId;
  name: string;
  displayName: string;
  modelId: string;
  capabilities: LLMModelCapabilities;
  inputCostPerToken: number;
  outputCostPerToken: number;
  contextWindow: number;
  latencyMs: number;
  availability: number;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "function";
  content: string;
  name?: string;
  functionCall?: LLMFunctionCall;
}

export interface LLMFunctionCall {
  name: string;
  arguments: string;
}

export interface LLMFunctionDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LLMRequest {
  id: string;
  modelId: LLMModelId;
  messages: LLMMessage[];
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stop: string[];
  functions?: LLMFunctionDefinition[];
  stream: boolean;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  id: string;
  requestId: string;
  modelId: LLMModelId;
  providerId: LLMProviderId;
  content: string | null;
  functionCall: LLMFunctionCall | null;
  usage: LLMUsage;
  finishReason: "stop" | "length" | "function_call" | "content_filter" | "error";
  latencyMs: number;
  timestamp: string;
}

export interface LLMStreamChunk {
  id: string;
  requestId: string;
  modelId: LLMModelId;
  providerId: LLMProviderId;
  content: string | null;
  functionCall: Partial<LLMFunctionCall> | null;
  usage: LLMUsage | null;
  finishReason: string | null;
  timestamp: string;
}

export interface ProviderConfig {
  providerId: LLMProviderId;
  provider: LLMProvider;
  apiKey: string;
  baseUrl: string;
  organizationId: string | null;
  defaultModelId: LLMModelId | null;
  rateLimitRpm: number;
  rateLimitTpm: number;
  timeoutMs: number;
  retries: number;
  retryDelayMs: number;
  enabled: boolean;
  priority: number;
}

export interface ModelConfig {
  modelId: LLMModelId;
  providerId: LLMProviderId;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stop: string[];
  responseFormat: "text" | "json" | null;
  seed: number | null;
}

export interface LLMConfig {
  providers: ProviderConfig[];
  models: ModelConfig[];
  defaultProviderId: LLMProviderId;
  defaultModelId: LLMModelId;
  routing: RoutingConfig;
  budget: BudgetConfig;
  fallback: FallbackConfig;
}

export enum RoutingStrategy {
  CostOptimized = "cost_optimized",
  PerformanceOptimized = "performance_optimized",
  Balanced = "balanced",
  RoundRobin = "round_robin",
  Weighted = "weighted",
  Adaptive = "adaptive",
  ContextAware = "context_aware",
}

export interface RoutingRule {
  id: string;
  name: string;
  condition: string;
  targetModelId: LLMModelId;
  priority: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
}

export interface RoutingConfig {
  strategy: RoutingStrategy;
  rules: RoutingRule[];
  defaultModelId: LLMModelId;
  enableCaching: boolean;
  cacheTtlMs: number;
  maxCacheSize: number;
}

export interface BudgetConfig {
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  perRequestLimitUsd: number;
  alertThresholdPercent: number;
  enableThrottling: boolean;
  throttleAtPercent: number;
}

export interface BudgetUsage {
  dailySpendUsd: number;
  monthlySpendUsd: number;
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  dailyPercentUsed: number;
  monthlyPercentUsed: number;
  totalTokensUsed: number;
  totalRequests: number;
  period: string;
}

export interface FallbackChain {
  id: string;
  name: string;
  modelIds: LLMModelId[];
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  conditions: string[];
}

export interface FallbackConfig {
  chains: FallbackChain[];
  defaultChainId: string;
  enableAutomaticFallback: boolean;
  fallbackOnError: boolean;
  fallbackOnTimeout: boolean;
  fallbackOnRateLimit: boolean;
  fallbackOnContentFilter: boolean;
}

export interface ProviderHealth {
  providerId: LLMProviderId;
  isHealthy: boolean;
  latencyMs: number;
  errorRate: number;
  successRate: number;
  lastError: string | null;
  lastSuccessAt: string | null;
  lastCheckAt: string;
  consecutiveErrors: number;
  circuitOpen: boolean;
  circuitOpenUntil: string | null;
}

export interface TokenUsage {
  providerId: LLMProviderId;
  modelId: LLMModelId;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  requestCount: number;
  period: string;
}

export interface JSONPathMapping {
  path: string;
  defaultValue: unknown;
  required: boolean;
  transform: string | null;
}

export interface RequestMapping {
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "PATCH";
  headers: Record<string, string>;
  bodyTemplate: Record<string, unknown>;
  messagePath: string;
  modelPath: string;
  temperaturePath: string;
  maxTokensPath: string;
  streamPathParam: string;
  customPaths: Record<string, JSONPathMapping>;
}

export interface ResponseMapping {
  contentPath: string;
  usagePath: string;
  promptTokensPath: string;
  completionTokensPath: string;
  totalTokensPath: string;
  finishReasonPath: string;
  functionCallPath: string | null;
  functionCallNamePath: string | null;
  functionCallArgumentsPath: string | null;
  errorPath: string;
  errorMessagePath: string;
  errorCodePath: string;
  customPaths: Record<string, JSONPathMapping>;
}

export interface StreamConfig {
  enabled: boolean;
  streamEndpoint: string | null;
  streamFormat: "sse" | "websocket" | "ndjson";
  chunkContentPath: string;
  chunkFinishPath: string;
  chunkUsagePath: string | null;
  delimiter: string;
  heartbeatIntervalMs: number;
}

export interface CustomProviderConfig {
  providerId: LLMProviderId;
  name: string;
  description: string;
  baseUrl: string;
  authentication: {
    type: "bearer" | "api_key" | "basic" | "custom";
    headerName: string;
    tokenTemplate: string;
  };
  requestMapping: RequestMapping;
  responseMapping: ResponseMapping;
  streamConfig: StreamConfig;
  healthCheckEndpoint: string | null;
  rateLimitRpm: number;
  timeoutMs: number;
}

export interface CapabilityDeclaration {
  name: string;
  supported: boolean;
  details: Record<string, unknown>;
  limitations: string[];
}

export interface ProviderTemplate {
  id: string;
  name: string;
  description: string;
  provider: LLMProvider;
  defaultConfig: CustomProviderConfig;
  capabilities: CapabilityDeclaration[];
  version: string;
  author: string;
}
