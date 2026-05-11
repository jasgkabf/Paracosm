import { EventEmitter } from "node:events";
import type { LLMResponse, LLMStreamChunk, LLMMessage, LLMUsage } from "@paracosm/shared";
import { Result, ok, err } from "@paracosm/shared";
import { LLMError } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";
import { RequestMapper } from "./request-mapper.js";
import { ResponseMapper } from "./response-mapper.js";
import { StreamParser } from "./stream-parser.js";
import type { CustomProviderInternalConfig } from "./types.js";

const logger = new Logger("CustomProvider");

export class CustomProvider extends EventEmitter {
  private config: CustomProviderInternalConfig;
  private requestMapper: RequestMapper;
  private responseMapper: ResponseMapper;
  private streamParser: StreamParser;

  constructor(config: CustomProviderInternalConfig) {
    super();
    this.config = config;
    this.requestMapper = new RequestMapper(config.requestMapping);
    this.responseMapper = new ResponseMapper(config.responseMapping);
    this.streamParser = new StreamParser(config.streamConfig);
  }

  async chat(messages: LLMMessage[], options?: { model?: string; temperature?: number; maxTokens?: number; stream?: boolean }): Promise<Result<LLMResponse, LLMError>> {
    const startTime = Date.now();
    try {
      const { url, headers, body } = this.requestMapper.buildRequest(messages, {
        model: options?.model ?? "default",
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 4096,
        stream: false,
      });

      this.injectAuth(headers);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const response = await fetch(url, {
          method: this.config.requestMapping.method,
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorBody = await response.text();
          const parsedError = this.responseMapper.extractError(errorBody);
          return err(new LLMError(
            parsedError.message || `HTTP ${response.status}`,
            { statusCode: response.status, providerId: this.config.providerId, errorCode: parsedError.code, retryable: response.status >= 500 || response.status === 429 },
          ));
        }

        const data = await response.json() as Record<string, unknown>;
        const mapped = this.responseMapper.mapResponse(data);

        const result: LLMResponse = {
          id: mapped.id ?? `custom_${Date.now()}`,
          requestId: "",
          modelId: options?.model as any ?? ("" as any),
          providerId: this.config.providerId as any,
          content: mapped.content,
          functionCall: mapped.functionCall ?? null,
          usage: mapped.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: (mapped.finishReason ?? "stop") as LLMResponse["finishReason"],
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };

        this.emit("chat", result);
        return ok(result);
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      return err(new LLMError(
        `Custom provider chat failed: ${error instanceof Error ? error.message : String(error)}`,
        { providerId: this.config.providerId },
        error instanceof Error ? error : undefined,
      ));
    }
  }

  async *chatStream(messages: LLMMessage[], options?: { model?: string; temperature?: number; maxTokens?: number }): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const { url, headers, body } = this.requestMapper.buildRequest(messages, {
      model: options?.model ?? "default",
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 4096,
      stream: true,
    });

    this.injectAuth(headers);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const streamUrl = this.config.streamConfig.streamEndpoint
        ? `${this.config.baseUrl}${this.config.streamConfig.streamEndpoint}`
        : url;

      const response = await fetch(streamUrl, {
        method: this.config.requestMapping.method,
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new LLMError(`HTTP ${response.status}: ${errorBody.substring(0, 200)}`, {
          statusCode: response.status,
          providerId: this.config.providerId,
        });
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new LLMError("No response body for streaming", { providerId: this.config.providerId });
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = this.streamParser.parse(buffer);
        buffer = this.streamParser.getRemainingBuffer();

        for (const chunk of chunks) {
          const mapped = this.responseMapper.mapStreamChunk(chunk.data);
          yield {
            id: `custom_${Date.now()}`,
            requestId: "",
            modelId: (options?.model ?? "") as any,
            providerId: this.config.providerId as any,
            content: mapped.content,
            functionCall: null,
            usage: mapped.usage ?? null,
            finishReason: mapped.finishReason ?? null,
            timestamp: new Date().toISOString(),
          };
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  async healthCheck(): Promise<Result<{ healthy: boolean; latencyMs: number }, LLMError>> {
    const startTime = Date.now();
    if (!this.config.healthCheckEndpoint) {
      return ok({ healthy: true, latencyMs: 0 });
    }

    try {
      const url = `${this.config.baseUrl}${this.config.healthCheckEndpoint}`;
      const headers: Record<string, string> = {};
      this.injectAuth(headers);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, { method: "GET", headers, signal: controller.signal });
      clearTimeout(timeout);

      return ok({
        healthy: response.ok,
        latencyMs: Date.now() - startTime,
      });
    } catch (error) {
      return ok({
        healthy: false,
        latencyMs: Date.now() - startTime,
      });
    }
  }

  getConfig(): CustomProviderInternalConfig {
    return this.config;
  }

  private injectAuth(headers: Record<string, string>): void {
    const auth = this.config.authentication;
    switch (auth.type) {
      case "bearer":
        headers[auth.headerName || "Authorization"] = `Bearer ${auth.tokenTemplate}`;
        break;
      case "api_key":
        headers[auth.headerName || "X-API-Key"] = auth.tokenTemplate;
        break;
      case "basic": {
        const encoded = Buffer.from(auth.tokenTemplate).toString("base64");
        headers[auth.headerName || "Authorization"] = `Basic ${encoded}`;
        break;
      }
      case "custom":
        headers[auth.headerName] = auth.tokenTemplate;
        break;
    }
  }
}
