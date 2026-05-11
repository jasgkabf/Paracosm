import type { LLMRequest, LLMResponse, LLMStreamChunk, LLMMessage, ProviderConfig } from "@paracosm/shared";
import { Result, ok, err } from "@paracosm/shared";
import { LLMError } from "@paracosm/shared";
import { BaseProvider, ChatOptions, EmbedResult, HealthStatus } from "./base-provider.js";

export class OpenAIProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  getProviderName(): string {
    return "openai";
  }

  protected buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
    };
    if (this.config.organizationId) {
      headers["OpenAI-Organization"] = this.config.organizationId;
    }
    return headers;
  }

  async chat(messages: LLMMessage[], options?: ChatOptions): Promise<Result<LLMResponse, LLMError>> {
    const startTime = Date.now();
    try {
      const model = options?.model ?? this.config.defaultModelId ?? "gpt-4o";
      const url = `${this.config.baseUrl}/chat/completions`;
      const headers = this.buildHeaders();
      const body = this.buildRequestBody(messages, { ...options, model } as ChatOptions);
      body.model = model as string;

      const response = await this.makeRequest(url, headers, body);
      if (!response.ok) {
        const errorBody = await response.text();
        return err(this.handleHttpError(response.status, errorBody));
      }

      const data = await response.json() as Record<string, unknown>;
      const choices = data.choices as Record<string, unknown>[];
      const choice = choices?.[0];
      const message = choice?.message as Record<string, unknown> | undefined;
      const usage = this.parseUsage(data.usage as Record<string, unknown> | undefined);

      let functionCall = null;
      if (message?.function_call) {
        const fc = message.function_call as Record<string, unknown>;
        functionCall = {
          name: fc.name as string,
          arguments: fc.arguments as string,
        };
      }

      const result = this.createResponse(
        data.id as string,
        "",
        (message?.content as string) ?? null,
        usage,
        (choice?.finish_reason as LLMResponse["finishReason"]) ?? "stop",
        Date.now() - startTime,
        functionCall,
      );

      this.emit("chat", result);
      return ok(result);
    } catch (error) {
      return err(new LLMError(
        `OpenAI chat failed: ${error instanceof Error ? error.message : String(error)}`,
        { providerId: this.config.providerId as string },
        error instanceof Error ? error : undefined,
      ));
    }
  }

  async *chatStream(messages: LLMMessage[], options?: ChatOptions): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const model = options?.model ?? this.config.defaultModelId ?? "gpt-4o";
    const url = `${this.config.baseUrl}/chat/completions`;
    const headers = this.buildHeaders();
    const body = this.buildRequestBody(messages, { ...options, stream: true, model } as ChatOptions);
    body.model = model as string;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw this.handleHttpError(response.status, errorBody);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new LLMError("No response body for streaming", { providerId: this.config.providerId as string });
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const chunk = JSON.parse(trimmed.slice(6)) as Record<string, unknown>;
            const choices = chunk.choices as Record<string, unknown>[];
            const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;

            const streamChunk: LLMStreamChunk = {
              id: chunk.id as string,
              requestId: "",
              modelId: this.config.defaultModelId ?? ("" as any),
              providerId: this.config.providerId,
              content: (delta?.content as string) ?? null,
              functionCall: delta?.function_call ? {
                name: (delta.function_call as Record<string, unknown>).name as string ?? null,
                arguments: (delta.function_call as Record<string, unknown>).arguments as string ?? null,
              } as any : null,
              usage: null,
              finishReason: (choices?.[0]?.finish_reason as string) ?? null,
              timestamp: new Date().toISOString(),
            };

            yield streamChunk;
          } catch {
            continue;
          }
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  async embed(text: string | string[], options?: { model?: string; dimensions?: number }): Promise<Result<EmbedResult, LLMError>> {
    try {
      const model = options?.model ?? "text-embedding-3-small";
      const url = `${this.config.baseUrl}/embeddings`;
      const headers = this.buildHeaders();
      const body: Record<string, unknown> = {
        model,
        input: text,
      };
      if (options?.dimensions) {
        body.dimensions = options.dimensions;
      }

      const response = await this.makeRequest(url, headers, body);
      if (!response.ok) {
        const errorBody = await response.text();
        return err(this.handleHttpError(response.status, errorBody));
      }

      const data = await response.json() as Record<string, unknown>;
      const embeddings = data.data as Record<string, unknown>[];
      const usage = data.usage as Record<string, unknown>;

      return ok({
        embedding: (embeddings[0]?.embedding as number[]) ?? [],
        model: model,
        usage: {
          promptTokens: (usage?.prompt_tokens as number) ?? 0,
          totalTokens: (usage?.total_tokens as number) ?? 0,
        },
      });
    } catch (error) {
      return err(new LLMError(
        `OpenAI embed failed: ${error instanceof Error ? error.message : String(error)}`,
        { providerId: this.config.providerId as string },
      ));
    }
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 3.5);
  }

  async healthCheck(): Promise<Result<HealthStatus, LLMError>> {
    const startTime = Date.now();
    try {
      const url = `${this.config.baseUrl}/models`;
      const headers = this.buildHeaders();
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      return ok({
        healthy: response.ok,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        details: { status: response.status },
      });
    } catch (error) {
      return ok({
        healthy: false,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
