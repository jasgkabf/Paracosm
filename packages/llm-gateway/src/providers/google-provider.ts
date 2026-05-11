import type { LLMResponse, LLMStreamChunk, LLMMessage, ProviderConfig } from "@paracosm/shared";
import { Result, ok, err } from "@paracosm/shared";
import { LLMError } from "@paracosm/shared";
import { BaseProvider, ChatOptions, EmbedResult, HealthStatus } from "./base-provider.js";

export class GoogleProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  getProviderName(): string {
    return "google";
  }

  protected buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
    };
  }

  async chat(messages: LLMMessage[], options?: ChatOptions): Promise<Result<LLMResponse, LLMError>> {
    const startTime = Date.now();
    try {
      const model = (options as any)?.model ?? this.config.defaultModelId ?? "gemini-1.5-pro";
      const url = `${this.config.baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`;
      const headers = this.buildHeaders();

      const body = this.buildGeminiBody(messages, options);

      const response = await this.makeRequest(url, headers, body);
      if (!response.ok) {
        const errorBody = await response.text();
        return err(this.handleHttpError(response.status, errorBody));
      }

      const data = await response.json() as Record<string, unknown>;
      const candidates = data.candidates as Record<string, unknown>[];
      const candidate = candidates?.[0];
      const content = candidate?.content as Record<string, unknown> | undefined;
      const parts = content?.parts as Record<string, unknown>[] | undefined;
      const textPart = parts?.find((p) => "text" in p);
      const functionCallPart = parts?.find((p) => "functionCall" in p);

      let functionCall = null;
      if (functionCallPart) {
        const fc = functionCallPart.functionCall as Record<string, unknown>;
        functionCall = {
          name: fc.name as string,
          arguments: typeof fc.args === "string" ? fc.args : JSON.stringify(fc.args ?? {}),
        };
      }

      const usageMetadata = data.usageMetadata as Record<string, unknown> | undefined;
      const usage = {
        promptTokens: (usageMetadata?.promptTokenCount as number) ?? 0,
        completionTokens: (usageMetadata?.candidatesTokenCount as number) ?? 0,
        totalTokens: (usageMetadata?.totalTokenCount as number) ?? 0,
      };

      const safetyRatings = candidate?.safetyRatings as Record<string, unknown>[] | undefined;
      const blocked = safetyRatings?.some((r) => r.probability === "HIGH");

      const result = this.createResponse(
        `google_${Date.now()}`,
        "",
        (textPart?.text as string) ?? null,
        usage,
        blocked ? "content_filter" : ((candidate?.finishReason as LLMResponse["finishReason"]) ?? "stop"),
        Date.now() - startTime,
        functionCall,
      );

      this.emit("chat", result);
      return ok(result);
    } catch (error) {
      return err(new LLMError(
        `Google chat failed: ${error instanceof Error ? error.message : String(error)}`,
        { providerId: this.config.providerId as string },
        error instanceof Error ? error : undefined,
      ));
    }
  }

  async *chatStream(messages: LLMMessage[], options?: ChatOptions): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const model = (options as any)?.model ?? this.config.defaultModelId ?? "gemini-1.5-pro";
    const url = `${this.config.baseUrl}/models/${model}:streamGenerateContent?key=${this.config.apiKey}&alt=sse`;
    const headers = this.buildHeaders();
    const body = this.buildGeminiBody(messages, options);

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
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const chunk = JSON.parse(trimmed.slice(6)) as Record<string, unknown>;
            const candidates = chunk.candidates as Record<string, unknown>[];
            const content = candidates?.[0]?.content as Record<string, unknown>;
            const parts = content?.parts as Record<string, unknown>[];
            const textPart = parts?.find((p) => "text" in p);

            const streamChunk: LLMStreamChunk = {
              id: `google_${Date.now()}`,
              requestId: "",
              modelId: this.config.defaultModelId ?? ("" as any),
              providerId: this.config.providerId,
              content: (textPart?.text as string) ?? null,
              functionCall: null,
              usage: null,
              finishReason: (candidates?.[0]?.finishReason as string) ?? null,
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
      const model = options?.model ?? "text-embedding-004";
      const url = `${this.config.baseUrl}/models/${model}:embedContent?key=${this.config.apiKey}`;
      const headers = this.buildHeaders();
      const body: Record<string, unknown> = {
        model: `models/${model}`,
        content: { parts: [{ text: Array.isArray(text) ? text.join(" ") : text }] },
      };

      const response = await this.makeRequest(url, headers, body);
      if (!response.ok) {
        const errorBody = await response.text();
        return err(this.handleHttpError(response.status, errorBody));
      }

      const data = await response.json() as Record<string, unknown>;
      return ok({
        embedding: (data.embedding as Record<string, unknown>)?.values as number[] ?? [],
        model,
        usage: { promptTokens: 0, totalTokens: 0 },
      });
    } catch (error) {
      return err(new LLMError(
        `Google embed failed: ${error instanceof Error ? error.message : String(error)}`,
        { providerId: this.config.providerId as string },
      ));
    }
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  async healthCheck(): Promise<Result<HealthStatus, LLMError>> {
    const startTime = Date.now();
    try {
      const url = `${this.config.baseUrl}/models?key=${this.config.apiKey}`;
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

  private buildGeminiBody(messages: LLMMessage[], options?: ChatOptions): Record<string, unknown> {
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const systemMessage = messages.find((m) => m.role === "system");

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 4096,
        topP: options?.topP ?? 1,
        ...(options?.stop ? { stopSequences: options.stop } : {}),
      },
    };

    if (systemMessage) {
      body.systemInstruction = { parts: [{ text: systemMessage.content }] };
    }

    if (options?.functions && options.functions.length > 0) {
      body.tools = [{
        functionDeclarations: options.functions.map((f) => ({
          name: f.name,
          description: f.description,
          parameters: f.parameters,
        })),
      }];
    }

    return body;
  }
}
