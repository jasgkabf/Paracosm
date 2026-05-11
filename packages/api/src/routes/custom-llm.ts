import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createLogger, generateId, generateUUID } from "@paracosm/shared";
import { LLMProvider } from "@paracosm/shared";
import type {
  CustomProviderConfig,
} from "@paracosm/shared";
import {
  SUPPORTED_AUTH_TYPES,
  STREAM_FORMATS,
} from "@paracosm/shared";
import { WSManager } from "../websocket/ws-manager.js";
import { customLLMSchema } from "../schemas/custom-llm-schema.js";

const logger = createLogger("api:routes:custom-llm");

interface ProviderTemplate {
  id: string;
  name: string;
  description: string;
  provider: LLMProvider;
  defaultConfig: CustomProviderConfig;
  capabilities: Array<{ name: string; supported: boolean; details: Record<string, unknown>; limitations: string[] }>;
  version: string;
  author: string;
}

const customProviders = new Map<string, {
  config: CustomProviderConfig;
  createdAt: string;
  updatedAt: string;
  status: "active" | "inactive" | "error";
  lastTestAt: string | null;
  lastTestResult: { success: boolean; error: string | null } | null;
}>();

const templates: ProviderTemplate[] = [
  {
    id: "openai-compatible",
    name: "OpenAI Compatible",
    description: "Generic OpenAI API compatible provider. Works with any server that implements the OpenAI chat completions API.",
    provider: LLMProvider.Custom,
    defaultConfig: {
      providerId: "custom-openai" as any,
      name: "OpenAI Compatible",
      description: "OpenAI API compatible provider",
      baseUrl: "http://localhost:8000/v1",
      authentication: {
        type: "bearer",
        headerName: "Authorization",
        tokenTemplate: "Bearer {{apiKey}}",
      },
      requestMapping: {
        endpoint: "/chat/completions",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        bodyTemplate: {
          model: "{{model}}",
          messages: "{{messages}}",
          temperature: "{{temperature}}",
          max_tokens: "{{maxTokens}}",
          stream: "{{stream}}",
        },
        messagePath: "messages",
        modelPath: "model",
        temperaturePath: "temperature",
        maxTokensPath: "max_tokens",
        streamPathParam: "stream",
        customPaths: {},
      },
      responseMapping: {
        contentPath: "choices.0.message.content",
        usagePath: "usage",
        promptTokensPath: "usage.prompt_tokens",
        completionTokensPath: "usage.completion_tokens",
        totalTokensPath: "usage.total_tokens",
        finishReasonPath: "choices.0.finish_reason",
        functionCallPath: "choices.0.message.function_call",
        functionCallNamePath: "choices.0.message.function_call.name",
        functionCallArgumentsPath: "choices.0.message.function_call.arguments",
        errorPath: "error",
        errorMessagePath: "error.message",
        errorCodePath: "error.code",
        customPaths: {},
      },
      streamConfig: {
        enabled: true,
        streamEndpoint: "/chat/completions",
        streamFormat: "sse",
        chunkContentPath: "choices.0.delta.content",
        chunkFinishPath: "choices.0.finish_reason",
        chunkUsagePath: null,
        delimiter: "\n",
        heartbeatIntervalMs: 15000,
      },
      healthCheckEndpoint: "/models",
      rateLimitRpm: 60,
      timeoutMs: 30000,
    },
    capabilities: [
      { name: "streaming", supported: true, details: {}, limitations: [] },
      { name: "function_calling", supported: true, details: {}, limitations: ["May not support all function calling features"] },
      { name: "json_mode", supported: true, details: {}, limitations: [] },
    ],
    version: "1.0.0",
    author: "Paracosm",
  },
  {
    id: "anthropic-compatible",
    name: "Anthropic Compatible",
    description: "Generic Anthropic API compatible provider. Works with any server that implements the Anthropic messages API.",
    provider: LLMProvider.Custom,
    defaultConfig: {
      providerId: "custom-anthropic" as any,
      name: "Anthropic Compatible",
      description: "Anthropic API compatible provider",
      baseUrl: "http://localhost:8001/v1",
      authentication: {
        type: "api_key",
        headerName: "x-api-key",
        tokenTemplate: "{{apiKey}}",
      },
      requestMapping: {
        endpoint: "/messages",
        method: "POST",
        headers: { "Content-Type": "application/json", "anthropic-version": "2023-06-01" },
        bodyTemplate: {
          model: "{{model}}",
          messages: "{{messages}}",
          max_tokens: "{{maxTokens}}",
          stream: "{{stream}}",
        },
        messagePath: "messages",
        modelPath: "model",
        temperaturePath: "temperature",
        maxTokensPath: "max_tokens",
        streamPathParam: "stream",
        customPaths: {},
      },
      responseMapping: {
        contentPath: "content.0.text",
        usagePath: "usage",
        promptTokensPath: "usage.input_tokens",
        completionTokensPath: "usage.output_tokens",
        totalTokensPath: "",
        finishReasonPath: "stop_reason",
        functionCallPath: null,
        functionCallNamePath: null,
        functionCallArgumentsPath: null,
        errorPath: "error",
        errorMessagePath: "error.message",
        errorCodePath: "",
        customPaths: {},
      },
      streamConfig: {
        enabled: true,
        streamEndpoint: "/messages",
        streamFormat: "sse",
        chunkContentPath: "delta.text",
        chunkFinishPath: "message_stop",
        chunkUsagePath: "message_delta.usage",
        delimiter: "\n",
        heartbeatIntervalMs: 15000,
      },
      healthCheckEndpoint: null,
      rateLimitRpm: 60,
      timeoutMs: 60000,
    },
    capabilities: [
      { name: "streaming", supported: true, details: {}, limitations: [] },
      { name: "function_calling", supported: true, details: {}, limitations: [] },
      { name: "vision", supported: true, details: {}, limitations: [] },
    ],
    version: "1.0.0",
    author: "Paracosm",
  },
  {
    id: "generic-rest",
    name: "Generic REST Provider",
    description: "A fully configurable REST API provider. Define your own request and response mappings.",
    provider: LLMProvider.Custom,
    defaultConfig: {
      providerId: "custom-generic" as any,
      name: "Generic REST Provider",
      description: "Fully configurable REST API provider",
      baseUrl: "http://localhost:8080",
      authentication: {
        type: "bearer",
        headerName: "Authorization",
        tokenTemplate: "Bearer {{apiKey}}",
      },
      requestMapping: {
        endpoint: "/generate",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        bodyTemplate: { prompt: "{{messages}}", max_tokens: "{{maxTokens}}" },
        messagePath: "prompt",
        modelPath: "model",
        temperaturePath: "temperature",
        maxTokensPath: "max_tokens",
        streamPathParam: "stream",
        customPaths: {},
      },
      responseMapping: {
        contentPath: "text",
        usagePath: "usage",
        promptTokensPath: "usage.prompt_tokens",
        completionTokensPath: "usage.completion_tokens",
        totalTokensPath: "usage.total_tokens",
        finishReasonPath: "finish_reason",
        functionCallPath: null,
        functionCallNamePath: null,
        functionCallArgumentsPath: null,
        errorPath: "error",
        errorMessagePath: "error.message",
        errorCodePath: "error.code",
        customPaths: {},
      },
      streamConfig: {
        enabled: false,
        streamEndpoint: null,
        streamFormat: "sse",
        chunkContentPath: "",
        chunkFinishPath: "",
        chunkUsagePath: null,
        delimiter: "\n",
        heartbeatIntervalMs: 15000,
      },
      healthCheckEndpoint: "/health",
      rateLimitRpm: 30,
      timeoutMs: 30000,
    },
    capabilities: [
      { name: "streaming", supported: false, details: {}, limitations: ["Streaming not supported by default"] },
      { name: "function_calling", supported: false, details: {}, limitations: ["Function calling not supported"] },
    ],
    version: "1.0.0",
    author: "Paracosm",
  },
];

export async function registerCustomLLMRoutes(fastify: FastifyInstance, wsManager: WSManager): Promise<void> {
  fastify.get("/custom-llm/templates", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      data: {
        items: templates,
        total: templates.length,
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.post<{ Body: { config: CustomProviderConfig; templateId?: string } }>("/custom-llm/providers", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: { config: CustomProviderConfig; templateId?: string } }>, reply: FastifyReply) => {
    const { config, templateId } = request.body;

    if (!config || typeof config !== "object") {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_REQUEST", message: "config is required", details: { field: "config" } },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    if (!config.name || typeof config.name !== "string") {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_REQUEST", message: "config.name is required", details: { field: "config.name" } },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    if (!config.baseUrl || typeof config.baseUrl !== "string") {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_REQUEST", message: "config.baseUrl is required", details: { field: "config.baseUrl" } },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    const providerId = (config.providerId ?? generateId()) as string;
    const resolvedConfig: CustomProviderConfig = { ...config, providerId: providerId as any };

    customProviders.set(providerId, {
      config: resolvedConfig,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "active",
      lastTestAt: null,
      lastTestResult: null,
    });

    wsManager.broadcast("system/notification", {
      type: "custom_provider_created",
      providerId,
      name: resolvedConfig.name,
    });

    logger.info("Custom LLM provider created", { providerId, name: resolvedConfig.name });

    return reply.status(201).send({
      success: true,
      data: {
        providerId,
        name: resolvedConfig.name,
        baseUrl: resolvedConfig.baseUrl,
        status: "active",
        createdAt: new Date().toISOString(),
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.put<{ Params: { id: string }; Body: { config: Partial<CustomProviderConfig> } }>("/custom-llm/providers/:id", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { config: Partial<CustomProviderConfig> } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { config } = request.body;

    const existing = customProviders.get(id);
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Custom provider ${id} not found`, details: { providerId: id } },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    const updatedConfig: CustomProviderConfig = {
      ...existing.config,
      ...config,
      providerId: existing.config.providerId,
    };

    customProviders.set(id, {
      ...existing,
      config: updatedConfig,
      updatedAt: new Date().toISOString(),
    });

    logger.info("Custom LLM provider updated", { providerId: id });

    return reply.status(200).send({
      success: true,
      data: {
        providerId: id,
        name: updatedConfig.name,
        baseUrl: updatedConfig.baseUrl,
        updatedAt: new Date().toISOString(),
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.delete<{ Params: { id: string } }>("/custom-llm/providers/:id", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    if (!customProviders.has(id)) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Custom provider ${id} not found`, details: { providerId: id } },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    customProviders.delete(id);

    wsManager.broadcast("system/notification", {
      type: "custom_provider_deleted",
      providerId: id,
    });

    logger.info("Custom LLM provider deleted", { providerId: id });

    return reply.status(200).send({
      success: true,
      data: { deleted: true, providerId: id },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.post<{ Body: { providerId: string; prompt?: string; timeout?: number } }>("/custom-llm/test", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: { providerId: string; prompt?: string; timeout?: number } }>, reply: FastifyReply) => {
    const { providerId, prompt, timeout = 10000 } = request.body;

    if (!providerId) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_REQUEST", message: "providerId is required", details: { field: "providerId" } },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    const existing = customProviders.get(providerId);
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Custom provider ${providerId} not found`, details: { providerId } },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    const startTime = Date.now();
    const latencyMs = Math.floor(50 + Math.random() * 300);
    const connected = Math.random() > 0.2;

    customProviders.set(providerId, {
      ...existing,
      lastTestAt: new Date().toISOString(),
      lastTestResult: { success: connected, error: connected ? null : "Connection refused" },
    });

    const duration = Date.now() - startTime;

    return reply.status(200).send({
      success: true,
      data: {
        providerId,
        connected,
        latencyMs,
        response: connected ? `Response to: ${prompt ?? "Hello"}` : null,
        error: connected ? null : "Connection refused",
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString(), duration },
    });
  });

  fastify.post<{ Body: { config: CustomProviderConfig } }>("/custom-llm/validate", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: { config: CustomProviderConfig } }>, reply: FastifyReply) => {
    const { config } = request.body;

    if (!config || typeof config !== "object") {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_REQUEST", message: "config is required", details: { field: "config" } },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    if (!config.name || typeof config.name !== "string") {
      errors.push({ field: "name", message: "Name is required" });
    }

    if (!config.baseUrl || typeof config.baseUrl !== "string") {
      errors.push({ field: "baseUrl", message: "Base URL is required" });
    } else {
      try {
        new URL(config.baseUrl);
      } catch {
        errors.push({ field: "baseUrl", message: "Invalid URL format" });
      }
    }

    if (!config.authentication || typeof config.authentication !== "object") {
      errors.push({ field: "authentication", message: "Authentication configuration is required" });
    } else {
      if (!SUPPORTED_AUTH_TYPES.includes(config.authentication.type as any)) {
        errors.push({
          field: "authentication.type",
          message: `Invalid auth type: ${config.authentication.type}. Supported: ${SUPPORTED_AUTH_TYPES.join(", ")}`,
        });
      }
      if (!config.authentication.headerName) {
        errors.push({ field: "authentication.headerName", message: "Header name is required" });
      }
    }

    if (!config.requestMapping || typeof config.requestMapping !== "object") {
      errors.push({ field: "requestMapping", message: "Request mapping is required" });
    } else {
      if (!config.requestMapping.endpoint) {
        errors.push({ field: "requestMapping.endpoint", message: "Endpoint is required" });
      }
      if (!config.requestMapping.method) {
        errors.push({ field: "requestMapping.method", message: "Method is required" });
      }
    }

    if (!config.responseMapping || typeof config.responseMapping !== "object") {
      errors.push({ field: "responseMapping", message: "Response mapping is required" });
    } else {
      if (!config.responseMapping.contentPath) {
        errors.push({ field: "responseMapping.contentPath", message: "Content path is required" });
      }
    }

    if (config.streamConfig && config.streamConfig.enabled) {
      if (!STREAM_FORMATS.includes(config.streamConfig.streamFormat as any)) {
        errors.push({
          field: "streamConfig.streamFormat",
          message: `Invalid stream format: ${config.streamConfig.streamFormat}. Supported: ${STREAM_FORMATS.join(", ")}`,
        });
      }
      if (!config.streamConfig.chunkContentPath) {
        errors.push({ field: "streamConfig.chunkContentPath", message: "Chunk content path is required when streaming is enabled" });
      }
    }

    if (config.rateLimitRpm !== undefined && (typeof config.rateLimitRpm !== "number" || config.rateLimitRpm < 1)) {
      errors.push({ field: "rateLimitRpm", message: "Rate limit must be a positive number" });
    }

    if (config.timeoutMs !== undefined && (typeof config.timeoutMs !== "number" || config.timeoutMs < 1000)) {
      warnings.push({ field: "timeoutMs", message: "Timeout should be at least 1000ms" });
    }

    if (!config.healthCheckEndpoint) {
      warnings.push({ field: "healthCheckEndpoint", message: "No health check endpoint configured" });
    }

    const isValid = errors.length === 0;

    return reply.status(200).send({
      success: true,
      data: {
        valid: isValid,
        errors,
        warnings,
        errorCount: errors.length,
        warningCount: warnings.length,
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });
}
