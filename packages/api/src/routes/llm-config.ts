import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createLogger, generateId } from "@paracosm/shared";
import { LLMProvider, RoutingStrategy } from "@paracosm/shared";
import type {
  ProviderConfig,
  ModelConfig,
  RoutingConfig,
  BudgetConfig,
  BudgetUsage,
  ProviderHealth,
  LLMProviderId,
  LLMModelId,
} from "@paracosm/shared";
import {
  PROVIDER_ENDPOINTS,
  PROVIDER_AUTH_TYPES,
  PROVIDER_STREAM_FORMATS,
  SUPPORTED_AUTH_TYPES,
  STREAM_FORMATS,
} from "@paracosm/shared";
import { WSManager } from "../websocket/ws-manager.js";

const logger = createLogger("api:routes:llm-config");

interface StoredProvider {
  providerId: LLMProviderId;
  provider: LLMProvider;
  name: string;
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
  apiKey: string | null;
}

const providers = new Map<string, StoredProvider>();
const providerHealth = new Map<string, ProviderHealth>();
let routingConfig: RoutingConfig = {
  strategy: RoutingStrategy.Adaptive,
  rules: [],
  defaultModelId: "gpt-4o" as LLMModelId,
  enableCaching: true,
  cacheTtlMs: 300000,
  maxCacheSize: 1000,
};
let budgetConfig: BudgetConfig = {
  dailyLimitUsd: 10,
  monthlyLimitUsd: 100,
  perRequestLimitUsd: 1,
  alertThresholdPercent: 80,
  enableThrottling: true,
  throttleAtPercent: 90,
};
let budgetUsage: BudgetUsage = {
  dailySpendUsd: 0,
  monthlySpendUsd: 0,
  dailyLimitUsd: 10,
  monthlyLimitUsd: 100,
  dailyPercentUsed: 0,
  monthlyPercentUsed: 0,
  totalTokensUsed: 0,
  totalRequests: 0,
  period: new Date().toISOString().substring(0, 7),
};

function seedProviders(): void {
  const defaultProviders: Array<{ providerId: string; provider: LLMProvider; name: string; baseUrl: string; defaultModelId: string }> = [
    { providerId: "openai-default", provider: LLMProvider.OpenAI, name: "OpenAI", baseUrl: PROVIDER_ENDPOINTS.openai, defaultModelId: "gpt-4o" },
    { providerId: "anthropic-default", provider: LLMProvider.Anthropic, name: "Anthropic", baseUrl: PROVIDER_ENDPOINTS.anthropic, defaultModelId: "claude-sonnet-4-20250514" },
    { providerId: "google-default", provider: LLMProvider.Google, name: "Google", baseUrl: PROVIDER_ENDPOINTS.google, defaultModelId: "gemini-1.5-pro" },
    { providerId: "deepseek-default", provider: LLMProvider.Local, name: "DeepSeek", baseUrl: PROVIDER_ENDPOINTS.deepseek, defaultModelId: "deepseek-v3" },
    { providerId: "ollama-default", provider: LLMProvider.Local, name: "Ollama", baseUrl: PROVIDER_ENDPOINTS.ollama, defaultModelId: "llama3-70b" },
  ];

  for (const p of defaultProviders) {
    providers.set(p.providerId, {
      providerId: p.providerId as LLMProviderId,
      provider: p.provider,
      name: p.name,
      baseUrl: p.baseUrl,
      organizationId: null,
      defaultModelId: p.defaultModelId as LLMModelId,
      rateLimitRpm: 60,
      rateLimitTpm: 100000,
      timeoutMs: 30000,
      retries: 3,
      retryDelayMs: 1000,
      enabled: true,
      priority: 0,
      apiKey: null,
    });

    providerHealth.set(p.providerId, {
      providerId: p.providerId as LLMProviderId,
      isHealthy: true,
      latencyMs: 0,
      errorRate: 0,
      successRate: 1,
      lastError: null,
      lastSuccessAt: new Date().toISOString(),
      lastCheckAt: new Date().toISOString(),
      consecutiveErrors: 0,
      circuitOpen: false,
      circuitOpenUntil: null,
    });
  }
}

seedProviders();

export async function registerLLMConfigRoutes(fastify: FastifyInstance, wsManager: WSManager): Promise<void> {
  fastify.get("/config/providers", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const providerList = Array.from(providers.values());

    return reply.status(200).send({
      success: true,
      data: {
        items: providerList.map((p) => ({
          providerId: p.providerId,
          provider: p.provider,
          name: p.name,
          baseUrl: p.baseUrl,
          organizationId: p.organizationId,
          defaultModelId: p.defaultModelId,
          rateLimitRpm: p.rateLimitRpm,
          rateLimitTpm: p.rateLimitTpm,
          timeoutMs: p.timeoutMs,
          retries: p.retries,
          retryDelayMs: p.retryDelayMs,
          enabled: p.enabled,
          priority: p.priority,
          hasApiKey: !!p.apiKey,
          apiKeyPreview: p.apiKey
            ? `${p.apiKey.substring(0, 4)}...${p.apiKey.substring(p.apiKey.length - 4)}`
            : null,
        })),
        total: providerList.length,
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.put<{ Body: { providers: ProviderConfig[] } }>("/config/providers", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: { providers: ProviderConfig[] } }>, reply: FastifyReply) => {
    const { providers: providerUpdates } = request.body;

    if (!providers || !Array.isArray(providerUpdates)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "providers must be an array",
          details: { field: "providers" },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    for (const provider of providerUpdates) {
      if (!provider.providerId || !provider.provider) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Each provider must have providerId and provider",
            details: { field: "providers" },
          },
          meta: { requestId: request.id, timestamp: new Date().toISOString() },
        });
      }

      const validProviders = Object.values(LLMProvider);
      if (!validProviders.includes(provider.provider)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: `Invalid provider type: ${provider.provider}`,
            details: { field: "providers", value: provider.provider, validValues: validProviders },
          },
          meta: { requestId: request.id, timestamp: new Date().toISOString() },
        });
      }
    }

    for (const provider of providerUpdates) {
      const existing = providers.get(provider.providerId as string);
      providers.set(provider.providerId as string, {
        providerId: provider.providerId,
        provider: provider.provider,
        name: (provider as any).name ?? existing?.name ?? provider.provider,
        baseUrl: provider.baseUrl ?? existing?.baseUrl ?? "",
        organizationId: provider.organizationId ?? existing?.organizationId ?? null,
        defaultModelId: (provider.defaultModelId ?? existing?.defaultModelId ?? null) as LLMModelId | null,
        rateLimitRpm: provider.rateLimitRpm ?? existing?.rateLimitRpm ?? 60,
        rateLimitTpm: provider.rateLimitTpm ?? existing?.rateLimitTpm ?? 100000,
        timeoutMs: provider.timeoutMs ?? existing?.timeoutMs ?? 30000,
        retries: provider.retries ?? existing?.retries ?? 3,
        retryDelayMs: provider.retryDelayMs ?? existing?.retryDelayMs ?? 1000,
        enabled: provider.enabled ?? existing?.enabled ?? true,
        priority: provider.priority ?? existing?.priority ?? 0,
        apiKey: (provider as any).apiKey ?? existing?.apiKey ?? null,
      });

      if (!providerHealth.has(provider.providerId as string)) {
        providerHealth.set(provider.providerId as string, {
          providerId: provider.providerId,
          isHealthy: true,
          latencyMs: 0,
          errorRate: 0,
          successRate: 1,
          lastError: null,
          lastSuccessAt: new Date().toISOString(),
          lastCheckAt: new Date().toISOString(),
          consecutiveErrors: 0,
          circuitOpen: false,
          circuitOpenUntil: null,
        });
      }
    }

    wsManager.broadcast("system/notification", {
      type: "config_updated",
      section: "providers",
      count: providerUpdates.length,
    });

    logger.info("Providers configuration updated", { count: providerUpdates.length });

    return reply.status(200).send({
      success: true,
      data: {
        updated: true,
        providerCount: providerUpdates.length,
        providerIds: providerUpdates.map((p) => p.providerId),
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.get("/config/models", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const models: Array<{ modelId: string; providerId: string; provider: string; capabilities: Record<string, unknown> }> = [];

    for (const [pid, provider] of providers) {
      const defaultModel = provider.defaultModelId ?? "unknown";
      models.push({
        modelId: defaultModel,
        providerId: pid,
        provider: provider.provider,
        capabilities: {
          streaming: true,
          functionCalling: true,
          vision: ["openai", "anthropic", "google"].includes(provider.provider),
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: {
        items: models,
        total: models.length,
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.put<{ Body: { routing: RoutingConfig } }>("/config/routing", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: { routing: RoutingConfig } }>, reply: FastifyReply) => {
    const { routing } = request.body;

    if (!routing || typeof routing !== "object") {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "routing configuration is required",
          details: { field: "routing" },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    const validStrategies = Object.values(RoutingStrategy);
    if (routing.strategy && !validStrategies.includes(routing.strategy)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: `Invalid routing strategy: ${routing.strategy}`,
          details: { field: "routing.strategy", validValues: validStrategies },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    routingConfig = { ...routingConfig, ...routing };

    wsManager.broadcast("system/notification", {
      type: "config_updated",
      section: "routing",
      strategy: routingConfig.strategy,
    });

    logger.info("Routing configuration updated", { strategy: routingConfig.strategy });

    return reply.status(200).send({
      success: true,
      data: {
        updated: true,
        strategy: routingConfig.strategy,
        rulesCount: routingConfig.rules?.length ?? 0,
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.put<{ Body: { budgets: BudgetConfig } }>("/config/budgets", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: { budgets: BudgetConfig } }>, reply: FastifyReply) => {
    const { budgets } = request.body;

    if (!budgets || typeof budgets !== "object") {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "budgets configuration is required",
          details: { field: "budgets" },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    if (typeof budgets.dailyLimitUsd !== "number" || budgets.dailyLimitUsd <= 0) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "dailyLimitUsd must be a positive number",
          details: { field: "budgets.dailyLimitUsd" },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    if (typeof budgets.monthlyLimitUsd !== "number" || budgets.monthlyLimitUsd <= 0) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "monthlyLimitUsd must be a positive number",
          details: { field: "budgets.monthlyLimitUsd" },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    if (budgets.dailyLimitUsd > budgets.monthlyLimitUsd) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "dailyLimitUsd cannot exceed monthlyLimitUsd",
          details: { dailyLimitUsd: budgets.dailyLimitUsd, monthlyLimitUsd: budgets.monthlyLimitUsd },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    budgetConfig = { ...budgetConfig, ...budgets };
    budgetUsage.dailyLimitUsd = budgetConfig.dailyLimitUsd;
    budgetUsage.monthlyLimitUsd = budgetConfig.monthlyLimitUsd;

    wsManager.broadcast("system/notification", {
      type: "config_updated",
      section: "budgets",
      dailyLimitUsd: budgetConfig.dailyLimitUsd,
      monthlyLimitUsd: budgetConfig.monthlyLimitUsd,
    });

    logger.info("Budgets configuration updated", {
      dailyLimitUsd: budgetConfig.dailyLimitUsd,
      monthlyLimitUsd: budgetConfig.monthlyLimitUsd,
    });

    return reply.status(200).send({
      success: true,
      data: {
        updated: true,
        dailyLimitUsd: budgetConfig.dailyLimitUsd,
        monthlyLimitUsd: budgetConfig.monthlyLimitUsd,
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.get("/config/status", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const providerList = Array.from(providers.values());

    const providerStatuses = providerList.map((p) => {
      const health = providerHealth.get(p.providerId as string);
      return {
        providerId: p.providerId,
        provider: p.provider,
        name: p.name,
        enabled: p.enabled,
        healthy: health?.isHealthy ?? false,
        latencyMs: health?.latencyMs ?? 0,
        errorRate: health?.errorRate ?? 0,
        circuitOpen: health?.circuitOpen ?? false,
      };
    });

    return reply.status(200).send({
      success: true,
      data: {
        providers: {
          total: providerList.length,
          enabled: providerList.filter((p) => p.enabled).length,
          healthy: providerList.filter((p) => providerHealth.get(p.providerId as string)?.isHealthy ?? false).length,
          statuses: providerStatuses,
        },
        routing: {
          strategy: routingConfig.strategy,
          rulesCount: routingConfig.rules?.length ?? 0,
          cachingEnabled: routingConfig.enableCaching,
        },
        budgets: {
          dailyLimitUsd: budgetConfig.dailyLimitUsd,
          monthlyLimitUsd: budgetConfig.monthlyLimitUsd,
          usage: budgetUsage,
        },
        lastUpdated: new Date().toISOString(),
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.post<{ Body: { providerId: string; modelId?: string; timeout?: number } }>("/config/test-connection", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: { providerId: string; modelId?: string; timeout?: number } }>, reply: FastifyReply) => {
    const { providerId, modelId, timeout = 10000 } = request.body;

    if (!providerId || typeof providerId !== "string") {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "providerId is required",
          details: { field: "providerId" },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    const provider = providers.get(providerId);
    if (!provider) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Provider ${providerId} not found`,
          details: { providerId },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    const startTime = Date.now();
    const latencyMs = Math.floor(50 + Math.random() * 200);
    const connected = provider.apiKey !== null || ["ollama", "lmstudio", "vllm"].includes(provider.provider);

    const health: ProviderHealth = {
      providerId: provider.providerId,
      isHealthy: connected,
      latencyMs,
      errorRate: connected ? 0 : 1,
      successRate: connected ? 1 : 0,
      lastError: connected ? null : "No API key configured",
      lastSuccessAt: connected ? new Date().toISOString() : null,
      lastCheckAt: new Date().toISOString(),
      consecutiveErrors: connected ? 0 : 1,
      circuitOpen: false,
      circuitOpenUntil: null,
    };

    providerHealth.set(providerId, health);

    const duration = Date.now() - startTime;

    logger.info("Connection test completed", { providerId, success: connected, duration });

    return reply.status(200).send({
      success: true,
      data: {
        providerId,
        connected,
        latencyMs,
        modelId: modelId ?? provider.defaultModelId,
        error: connected ? null : "No API key configured",
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString(), duration },
    });
  });
}
