import { EventEmitter } from "node:events";
import type { LLMRequest, LLMResponse, LLMStreamChunk, LLMUsage, ProviderConfig, LLMFunctionDefinition, LLMMessage } from "@paracosm/shared";
import { Result, ok, err } from "@paracosm/shared";
import { LLMError } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";

const logger = new Logger("BaseProvider");

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  functions?: LLMFunctionDefinition[];
  responseFormat?: "text" | "json";
  stream?: boolean;
}

export interface EmbedOptions {
  model?: string;
  dimensions?: number;
}

export interface EmbedResult {
  embedding: number[];
  model: string;
  usage: { promptTokens: number; totalTokens: number };
}

export interface HealthStatus {
  healthy: boolean;
  latencyMs: number;
  lastChecked: string;
  error?: string;
  details?: Record<string, unknown>;
}

export abstract class BaseProvider extends EventEmitter {
  protected config: ProviderConfig;
  protected logger: Logger;

  constructor(config: ProviderConfig) {
    super();
    this.config = config;
    this.logger = new Logger(`${this.getProviderName()}:${config.providerId}`);
  }

  abstract chat(messages: LLMMessage[], options?: ChatOptions): Promise<Result<LLMResponse, LLMError>>;
  abstract chatStream(messages: LLMMessage[], options?: ChatOptions): AsyncGenerator<LLMStreamChunk, void, unknown>;
  abstract countTokens(text: string): number;
  abstract healthCheck(): Promise<Result<HealthStatus, LLMError>>;

  async embed?(text: string | string[], options?: EmbedOptions): Promise<Result<EmbedResult, LLMError>>;

  abstract getProviderName(): string;

  getConfig(): ProviderConfig {
    return this.config;
  }

  getProviderId(): string {
    return this.config.providerId as string;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  protected buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
    };
  }

  protected buildRequestBody(messages: LLMMessage[], options?: ChatOptions): Record<string, unknown> {
    const body: Record<string, unknown> = {
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.name ? { name: m.name } : {}),
        ...(m.functionCall ? { function_call: m.functionCall } : {}),
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
      top_p: options?.topP ?? 1,
      stream: options?.stream ?? false,
    };

    if (options?.frequencyPenalty) {
      body.frequency_penalty = options.frequencyPenalty;
    }
    if (options?.presencePenalty) {
      body.presence_penalty = options.presencePenalty;
    }
    if (options?.stop && options.stop.length > 0) {
      body.stop = options.stop;
    }
    if (options?.functions && options.functions.length > 0) {
      body.functions = options.functions;
    }
    if (options?.responseFormat) {
      body.response_format = { type: options.responseFormat };
    }

    return body;
  }

  protected async makeRequest(url: string, headers: Record<string, string>, body: Record<string, unknown>): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  protected parseUsage(usage: Record<string, unknown> | undefined): LLMUsage {
    if (!usage) {
      return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    }
    return {
      promptTokens: (usage.prompt_tokens as number) ?? (usage.promptTokens as number) ?? 0,
      completionTokens: (usage.completion_tokens as number) ?? (usage.completionTokens as number) ?? 0,
      totalTokens: (usage.total_tokens as number) ?? (usage.totalTokens as number) ?? 0,
    };
  }

  protected createResponse(id: string, requestId: string, content: string | null, usage: LLMUsage, finishReason: LLMResponse["finishReason"], latencyMs: number, functionCall?: LLMResponse["functionCall"]): LLMResponse {
    return {
      id,
      requestId,
      modelId: this.config.defaultModelId ?? ("" as any),
      providerId: this.config.providerId,
      content,
      functionCall: functionCall ?? null,
      usage,
      finishReason,
      latencyMs,
      timestamp: new Date().toISOString(),
    };
  }

  protected handleHttpError(status: number, body: string): LLMError {
    const retryable = status === 429 || status >= 500;
    return new LLMError(
      `HTTP ${status}: ${body.substring(0, 200)}`,
      { statusCode: status, retryable, providerId: this.config.providerId as string },
    );
  }
}
