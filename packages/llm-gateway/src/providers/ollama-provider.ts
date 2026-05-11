import type { LLMResponse, LLMStreamChunk, LLMMessage, ProviderConfig } from "@paracosm/shared";
import { Result, ok, err } from "@paracosm/shared";
import { LLMError } from "@paracosm/shared";
import { BaseProvider, ChatOptions, EmbedResult, HealthStatus } from "./base-provider.js";

export class OllamaProvider extends BaseProvider {
  private discoveredModels: string[] = [];

  constructor(config: ProviderConfig) {
    super(config);
  }

  getProviderName(): string {
    return "ollama";
  }

  protected buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
    };
  }

  async chat(messages: LLMMessage[], options?: ChatOptions): Promise<Result<LLMResponse, LLMError>> {
    const startTime = Date.now();
    try {
      const model = (options as any)?.model ?? this.config.defaultModelId ?? "llama3";
      const url = `${this.config.baseUrl}/chat`;
      const headers = this.buildHeaders();
      const body: Record<string, unknown> = {
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.name ? { name: m.name } : {}),
        })),
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 4096,
          top_p: options?.topP ?? 1,
          ...(options?.frequencyPenalty ? { frequency_penalty: options.frequencyPenalty } : {}),
          ...(options?.presencePenalty ? { presence_penalty: options.presencePenalty } : {}),
          ...(options?.stop ? { stop: options.stop } : {}),
        },
      };

      const response = await this.makeRequest(url, headers, body);
      if (!response.ok) {
        const errorBody = await response.text();
        return err(this.handleHttpError(response.status, errorBody));
      }

      const data = await response.json() as Record<string, unknown>;
      const message = data.message as Record<string, unknown>;

      const usage = {
        promptTokens: (data.prompt_eval_count as number) ?? 0,
        completionTokens: (data.eval_count as number) ?? 0,
        totalTokens: ((data.prompt_eval_count as number) ?? 0) + ((data.eval_count as number) ?? 0),
      };

      const result = this.createResponse(
        `ollama_${Date.now()}`,
        "",
        (message?.content as string) ?? null,
        usage,
        "stop",
        Date.now() - startTime,
      );

      this.emit("chat", result);
      return ok(result);
    } catch (error) {
      return err(new LLMError(
        `Ollama chat failed: ${error instanceof Error ? error.message : String(error)}`,
        { providerId: this.config.providerId as string },
        error instanceof Error ? error : undefined,
      ));
    }
  }

  async *chatStream(messages: LLMMessage[], options?: ChatOptions): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const model = (options as any)?.model ?? this.config.defaultModelId ?? "llama3";
    const url = `${this.config.baseUrl}/chat`;
    const headers = this.buildHeaders();
    const body: Record<string, unknown> = {
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens ?? 4096,
      },
    };

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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n").filter((l) => l.trim());

        for (const line of lines) {
          try {
            const chunk = JSON.parse(line) as Record<string, unknown>;
            const message = chunk.message as Record<string, unknown>;

            yield {
              id: `ollama_${Date.now()}`,
              requestId: "",
              modelId: this.config.defaultModelId ?? ("" as any),
              providerId: this.config.providerId,
              content: (message?.content as string) ?? null,
              functionCall: null,
              usage: null,
              finishReason: chunk.done ? "stop" : null,
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

  async embed(text: string | string[], options?: { model?: string }): Promise<Result<EmbedResult, LLMError>> {
    try {
      const model = options?.model ?? "nomic-embed-text";
      const url = `${this.config.baseUrl}/embeddings`;
      const headers = this.buildHeaders();
      const body: Record<string, unknown> = {
        model,
        prompt: Array.isArray(text) ? text.join(" ") : text,
      };

      const response = await this.makeRequest(url, headers, body);
      if (!response.ok) {
        const errorBody = await response.text();
        return err(this.handleHttpError(response.status, errorBody));
      }

      const data = await response.json() as Record<string, unknown>;
      return ok({
        embedding: data.embedding as number[] ?? [],
        model,
        usage: { promptTokens: (data.prompt_eval_count as number) ?? 0, totalTokens: (data.prompt_eval_count as number) ?? 0 },
      });
    } catch (error) {
      return err(new LLMError(
        `Ollama embed failed: ${error instanceof Error ? error.message : String(error)}`,
        { providerId: this.config.providerId as string },
      ));
    }
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  async listModels(): Promise<Result<string[], LLMError>> {
    try {
      const url = `${this.config.baseUrl}/tags`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, { method: "GET", signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        return err(new LLMError("Failed to list Ollama models", { status: response.status }));
      }

      const data = await response.json() as Record<string, unknown>;
      const models = (data.models as Record<string, unknown>[]) ?? [];
      this.discoveredModels = models.map((m) => m.name as string);
      return ok(this.discoveredModels);
    } catch (error) {
      return err(new LLMError(
        `Failed to list Ollama models: ${error instanceof Error ? error.message : String(error)}`,
        { providerId: this.config.providerId as string },
      ));
    }
  }

  async pullModel(modelName: string): Promise<Result<void, LLMError>> {
    try {
      const url = `${this.config.baseUrl}/pull`;
      const headers = this.buildHeaders();
      const body = { name: modelName, stream: false };

      const response = await this.makeRequest(url, headers, body);
      if (!response.ok) {
        const errorBody = await response.text();
        return err(this.handleHttpError(response.status, errorBody));
      }

      return ok(undefined);
    } catch (error) {
      return err(new LLMError(
        `Failed to pull model ${modelName}: ${error instanceof Error ? error.message : String(error)}`,
        { providerId: this.config.providerId as string, modelName },
      ));
    }
  }

  async autoDiscover(): Promise<Result<string[], LLMError>> {
    return this.listModels();
  }

  async healthCheck(): Promise<Result<HealthStatus, LLMError>> {
    const startTime = Date.now();
    try {
      const url = `${this.config.baseUrl}/tags`;
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
