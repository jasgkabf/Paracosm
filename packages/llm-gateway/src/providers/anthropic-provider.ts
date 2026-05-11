import type { LLMResponse, LLMStreamChunk, LLMMessage, ProviderConfig } from "@paracosm/shared";
import { Result, ok, err } from "@paracosm/shared";
import { LLMError } from "@paracosm/shared";
import { BaseProvider, ChatOptions, HealthStatus } from "./base-provider.js";

export class AnthropicProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  getProviderName(): string {
    return "anthropic";
  }

  protected buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.config.apiKey,
      "anthropic-version": "2023-06-01",
    };
  }

  async chat(messages: LLMMessage[], options?: ChatOptions): Promise<Result<LLMResponse, LLMError>> {
    const startTime = Date.now();
    try {
      const model = options?.model ?? this.config.defaultModelId ?? "claude-sonnet-4-20250514";
      const url = `${this.config.baseUrl}/messages`;
      const headers = this.buildHeaders();

      const systemMessage = messages.find((m) => m.role === "system");
      const nonSystemMessages = messages.filter((m) => m.role !== "system");

      const body: Record<string, unknown> = {
        model,
        max_tokens: options?.maxTokens ?? 4096,
        messages: nonSystemMessages.map((m) => this.formatMessage(m)),
        temperature: options?.temperature ?? 0.7,
        top_p: options?.topP ?? 1,
        stream: false,
      };

      if (systemMessage) {
        body.system = systemMessage.content;
      }

      if (options?.stop && options.stop.length > 0) {
        body.stop_sequences = options.stop;
      }

      if (options?.functions && options.functions.length > 0) {
        body.tools = options.functions.map((f) => ({
          name: f.name,
          description: f.description,
          input_schema: f.parameters,
        }));
      }

      const response = await this.makeRequest(url, headers, body);
      if (!response.ok) {
        const errorBody = await response.text();
        return err(this.handleHttpError(response.status, errorBody));
      }

      const data = await response.json() as Record<string, unknown>;
      const content = data.content as Record<string, unknown>[];
      const textBlock = content?.find((c) => c.type === "text");
      const toolUseBlock = content?.find((c) => c.type === "tool_use");

      let functionCall = null;
      if (toolUseBlock) {
        functionCall = {
          name: toolUseBlock.name as string,
          arguments: typeof toolUseBlock.input === "string" ? toolUseBlock.input : JSON.stringify(toolUseBlock.input),
        };
      }

      const usage = {
        promptTokens: (data.usage as Record<string, unknown>)?.input_tokens as number ?? 0,
        completionTokens: (data.usage as Record<string, unknown>)?.output_tokens as number ?? 0,
        totalTokens: ((data.usage as Record<string, unknown>)?.input_tokens as number ?? 0) + ((data.usage as Record<string, unknown>)?.output_tokens as number ?? 0),
      };

      const result = this.createResponse(
        data.id as string,
        "",
        (textBlock?.text as string) ?? null,
        usage,
        (data.stop_reason as LLMResponse["finishReason"]) ?? "stop",
        Date.now() - startTime,
        functionCall,
      );

      this.emit("chat", result);
      return ok(result);
    } catch (error) {
      return err(new LLMError(
        `Anthropic chat failed: ${error instanceof Error ? error.message : String(error)}`,
        { providerId: this.config.providerId as string },
        error instanceof Error ? error : undefined,
      ));
    }
  }

  async *chatStream(messages: LLMMessage[], options?: ChatOptions): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const model = (options as any)?.model ?? this.config.defaultModelId ?? "claude-sonnet-4-20250514";
    const url = `${this.config.baseUrl}/messages`;
    const headers = this.buildHeaders();

    const systemMessage = messages.find((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model,
      max_tokens: options?.maxTokens ?? 4096,
      messages: nonSystemMessages.map((m) => this.formatMessage(m)),
      temperature: options?.temperature ?? 0.7,
      stream: true,
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

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
            const event = JSON.parse(trimmed.slice(6)) as Record<string, unknown>;
            const eventType = event.type as string;

            if (eventType === "content_block_delta") {
              const delta = event.delta as Record<string, unknown>;
              const streamChunk: LLMStreamChunk = {
                id: (event as any).message?.id ?? "",
                requestId: "",
                modelId: this.config.defaultModelId ?? ("" as any),
                providerId: this.config.providerId,
                content: (delta?.text as string) ?? null,
                functionCall: null,
                usage: null,
                finishReason: null,
                timestamp: new Date().toISOString(),
              };
              yield streamChunk;
            } else if (eventType === "message_stop") {
              return;
            }
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
    return Math.ceil(text.length / 3.5);
  }

  async healthCheck(): Promise<Result<HealthStatus, LLMError>> {
    const startTime = Date.now();
    try {
      return ok({
        healthy: true,
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

  private formatMessage(message: LLMMessage): Record<string, unknown> {
    const formatted: Record<string, unknown> = {
      role: message.role === "function" ? "user" : message.role,
      content: message.content,
    };
    if (message.functionCall) {
      formatted.content = [
        { type: "text", text: message.content },
        {
          type: "tool_use",
          id: `toolu_${Date.now()}`,
          name: message.functionCall.name,
          input: JSON.parse(message.functionCall.arguments || "{}"),
        },
      ];
    }
    return formatted;
  }
}
