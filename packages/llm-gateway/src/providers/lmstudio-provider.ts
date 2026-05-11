import type { LLMResponse, LLMStreamChunk, LLMMessage, ProviderConfig } from "@paracosm/shared";
import { Result, ok, err } from "@paracosm/shared";
import { LLMError } from "@paracosm/shared";
import { BaseProvider, ChatOptions, HealthStatus } from "./base-provider.js";

export class LMStudioProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  getProviderName(): string {
    return "lmstudio";
  }

  protected buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
    };
  }

  async chat(messages: LLMMessage[], options?: ChatOptions): Promise<Result<LLMResponse, LLMError>> {
    const startTime = Date.now();
    try {
      const model = (options as any)?.model ?? this.config.defaultModelId ?? "default";
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

      const result = this.createResponse(
        data.id as string ?? `lmstudio_${Date.now()}`,
        "",
        (message?.content as string) ?? null,
        usage,
        (choice?.finish_reason as LLMResponse["finishReason"]) ?? "stop",
        Date.now() - startTime,
      );

      this.emit("chat", result);
      return ok(result);
    } catch (error) {
      return err(new LLMError(
        `LMStudio chat failed: ${error instanceof Error ? error.message : String(error)}`,
        { providerId: this.config.providerId as string },
        error instanceof Error ? error : undefined,
      ));
    }
  }

  async *chatStream(messages: LLMMessage[], options?: ChatOptions): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const model = (options as any)?.model ?? this.config.defaultModelId ?? "default";
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
      if (!reader) throw new LLMError("No response body", { providerId: this.config.providerId as string });

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

            yield {
              id: chunk.id as string ?? `lmstudio_${Date.now()}`,
              requestId: "",
              modelId: this.config.defaultModelId ?? ("" as any),
              providerId: this.config.providerId,
              content: (delta?.content as string) ?? null,
              functionCall: null,
              usage: null,
              finishReason: (choices?.[0]?.finish_reason as string) ?? null,
              timestamp: new Date().toISOString(),
            };
          } catch {
            continue;
          }
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  async listModels(): Promise<Result<string[], LLMError>> {
    try {
      const url = `${this.config.baseUrl}/models`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, { method: "GET", signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        return err(new LLMError("Failed to list LMStudio models", { status: response.status }));
      }

      const data = await response.json() as Record<string, unknown>;
      const models = (data.data as Record<string, unknown>[]) ?? [];
      return ok(models.map((m) => m.id as string));
    } catch (error) {
      return err(new LLMError(
        `Failed to list LMStudio models: ${error instanceof Error ? error.message : String(error)}`,
        { providerId: this.config.providerId as string },
      ));
    }
  }

  async loadModel(modelId: string): Promise<Result<void, LLMError>> {
    try {
      const url = `${this.config.baseUrl}/models/load`;
      const headers = this.buildHeaders();
      const body = { model: modelId };

      const response = await this.makeRequest(url, headers, body);
      if (!response.ok) {
        const errorBody = await response.text();
        return err(this.handleHttpError(response.status, errorBody));
      }

      return ok(undefined);
    } catch (error) {
      return err(new LLMError(
        `Failed to load model ${modelId}: ${error instanceof Error ? error.message : String(error)}`,
        { providerId: this.config.providerId as string, modelId },
      ));
    }
  }

  async healthCheck(): Promise<Result<HealthStatus, LLMError>> {
    const startTime = Date.now();
    try {
      const url = `${this.config.baseUrl}/models`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, { method: "GET", signal: controller.signal });
      clearTimeout(timeout);

      return ok({
        healthy: response.ok,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
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
