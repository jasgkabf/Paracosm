import type { LLMRequest, LLMResponse, LLMStreamChunk, CustomProviderConfig, ProviderConfig } from '@paracosm/shared';
import { BaseProvider, type ProviderCapabilities, type ProviderRequestOptions } from '../base-provider.js';
import { RequestMapper } from './request-mapper.js';
import { ResponseMapper } from './response-mapper.js';
import { StreamParser } from './stream-parser.js';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('CustomProvider');

export class CustomProvider extends BaseProvider {
  private customConfig: CustomProviderConfig;
  private requestMapper: RequestMapper;
  private responseMapper: ResponseMapper;
  private streamParser: StreamParser;

  get name(): string {
    return this.customConfig.name;
  }

  get capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      functionCalling: false,
      vision: false,
      audio: false,
      embeddings: false,
      maxContextTokens: 128000,
      maxOutputTokens: 4096,
    };
  }

  constructor(config: CustomProviderConfig, providerConfig?: ProviderConfig) {
    super(providerConfig || {
      provider: 'custom' as const,
      apiKey: config.apiKey ?? '',
      baseUrl: config.baseUrl,
      models: config.supportedModels,
      defaultModel: config.supportedModels[0] ?? 'default',
      maxConcurrentRequests: 10,
      timeout: 60000,
      retries: 3,
      metadata: config.metadata,
    });

    this.customConfig = config;
    this.requestMapper = new RequestMapper(config.requestMapping);
    this.responseMapper = new ResponseMapper(config.responseMapping);
    this.streamParser = new StreamParser(config.responseMapping);
  }

  async complete(request: LLMRequest, options?: ProviderRequestOptions): Promise<LLMResponse> {
    const startTime = Date.now();
    const url = this.buildEndpointUrl();

    const mappedBody = this.requestMapper.map(request);
    const headers = this.buildCustomHeaders();

    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(mappedBody),
          signal: options?.signal,
        },
        options?.timeout ?? this.config.timeout,
      );

      if (!response.ok) {
        const errorBody = await response.text();
        const errorMessage = this.responseMapper.extractError(errorBody);
        throw new Error(`Custom provider '${this.customConfig.name}' error ${response.status}: ${errorMessage}`);
      }

      const data = await this.parseJsonResponse<Record<string, unknown>>(response);
      const latencyMs = Date.now() - startTime;

      const content = this.responseMapper.extractContent(data);
      const model = this.responseMapper.extractModel(data) ?? request.model;
      const finishReason = this.responseMapper.extractFinishReason(data) ?? 'stop';
      const usage = this.responseMapper.extractUsage(data);

      return this.createResponse(
        request.id,
        content,
        model,
        finishReason,
        usage,
        latencyMs,
      );
    } catch (error) {
      this.handleError(error, request.id);
    }
  }

  async *stream(request: LLMRequest, options?: ProviderRequestOptions): AsyncIterable<LLMStreamChunk> {
    const url = this.buildEndpointUrl();
    const mappedBody = this.requestMapper.map(request);
    const headers = this.buildCustomHeaders();

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(mappedBody),
        signal: options?.signal,
      },
      options?.timeout ?? this.config.timeout,
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Custom provider '${this.customConfig.name}' error ${response.status}: ${errorBody}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body for streaming');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const parsed = this.streamParser.parseLine(trimmed);
          if (!parsed) continue;

          if (parsed.done) {
            yield this.createStreamChunk(request.id, '', request.model, 'stop');
            return;
          }

          yield this.createStreamChunk(
            request.id,
            parsed.content,
            request.model,
            parsed.finishReason,
          );
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  getCustomConfig(): CustomProviderConfig {
    return { ...this.customConfig };
  }

  private buildEndpointUrl(): string {
    const base = this.customConfig.baseUrl.replace(/\/$/, '');
    return `${base}/chat/completions`;
  }

  private buildCustomHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.customConfig.headers,
    };

    if (this.customConfig.apiKey) {
      if (!headers['Authorization']) {
        headers['Authorization'] = `Bearer ${this.customConfig.apiKey}`;
      }
    }

    return headers;
  }
}
