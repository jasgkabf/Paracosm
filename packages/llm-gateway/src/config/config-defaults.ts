import { LLMProvider, RoutingStrategy } from "@paracosm/shared";
import type { ProviderConfig, ModelConfig, RoutingConfig, BudgetConfig, FallbackConfig, RoutingRule } from "@paracosm/shared";

export const DEFAULT_PROVIDER_CONFIGS: Omit<ProviderConfig, "providerId" | "apiKey">[] = [
  {
    provider: LLMProvider.OpenAI,
    baseUrl: "https://api.openai.com/v1",
    organizationId: null,
    defaultModelId: null,
    rateLimitRpm: 500,
    rateLimitTpm: 200000,
    timeoutMs: 30000,
    retries: 3,
    retryDelayMs: 1000,
    enabled: true,
    priority: 1,
  },
  {
    provider: LLMProvider.Anthropic,
    baseUrl: "https://api.anthropic.com/v1",
    organizationId: null,
    defaultModelId: null,
    rateLimitRpm: 400,
    rateLimitTpm: 160000,
    timeoutMs: 60000,
    retries: 3,
    retryDelayMs: 1000,
    enabled: true,
    priority: 2,
  },
  {
    provider: LLMProvider.Google,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    organizationId: null,
    defaultModelId: null,
    rateLimitRpm: 300,
    rateLimitTpm: 120000,
    timeoutMs: 45000,
    retries: 3,
    retryDelayMs: 1000,
    enabled: true,
    priority: 3,
  },
];

export const DEFAULT_MODEL_CONFIGS: Omit<ModelConfig, "modelId" | "providerId">[] = [
  { temperature: 0.7, maxTokens: 4096, topP: 1, frequencyPenalty: 0, presencePenalty: 0, stop: [], responseFormat: null, seed: null },
];

export const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  strategy: RoutingStrategy.Balanced,
  rules: [],
  defaultModelId: "" as any,
  enableCaching: true,
  cacheTtlMs: 300000,
  maxCacheSize: 1000,
};

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  dailyLimitUsd: 50,
  monthlyLimitUsd: 1000,
  perRequestLimitUsd: 5,
  alertThresholdPercent: 80,
  enableThrottling: true,
  throttleAtPercent: 90,
};

export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  chains: [],
  defaultChainId: "default",
  enableAutomaticFallback: true,
  fallbackOnError: true,
  fallbackOnTimeout: true,
  fallbackOnRateLimit: true,
  fallbackOnContentFilter: false,
};

export const DEFAULT_ROUTING_RULE: Omit<RoutingRule, "id"> = {
  name: "",
  condition: "",
  targetModelId: "" as any,
  priority: 0,
  enabled: true,
  metadata: {},
};

export const CONFIG_VERSION = 1;

export const CONFIG_FILE_NAMES = {
  providers: "providers.yaml",
  models: "models.yaml",
  routing: "routing.yaml",
  budgets: "budgets.yaml",
  fallback: "fallback.yaml",
} as const;

export const DEFAULT_DEBOUNCE_MS = 500;
export const DEFAULT_WATCH_INTERVAL_MS = 2000;
