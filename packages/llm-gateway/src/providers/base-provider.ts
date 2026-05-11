import type { LLMRequest, LLMResponse, LLMStreamChunk, ProviderConfig, TokenUsage } from '@paracosm/shared';
import { createLogger, generateId } from '@paracosm/shared';

const logger = createLogger('BaseProvider');

export interface ProviderRequestOptions {
  signal?: AbortSignal;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

export interface ProviderCapabilities {
  streaming: boolean;
  functionCalling: boolean;
  vision: boolean;
  audio: boolean;
  embeddings: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
}

export abstract class BaseProvider {
  protected config: ProviderConfig;
  protected logger: ReturnType<typeof createLogger>;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.logger = createLogger(`Provider:${config.provider}`);
  }

  abstract get name(): string;
  abstract get capabilities(): ProviderCapabilities;

  abstract complete(request: LLMRequest, options?: ProviderRequestOptions): Promise<LLMResponse>;
  abstract stream(request: LLMRequest, options?: ProviderRequestOptions): AsyncIterable<LLMStreamChunk>;

  async healthCheck(): Promise<boolean> {
    try {
      const testRequest: LLMRequest = {
        id: generateId(),
        model: this.config.defaultModel,
        provider: this.config.provider,
        prompt: 'test',
        maxTokens: 1,
        metadata: {},
        timestamp: new Date(),
      };

      const response = await this.complete(testRequest, { timeout: 10000 });
      return response.content.length >= 0;
    } catch (error) {
      this.logger.warn('Health check failed', { error: (error as Error).message });
      return false;
    }
  }

  getConfig(): ProviderConfig {
    return { ...this.config };
  }

  getModels(): string[] {
    return [...this.config.models];
  }

  getDefaultModel(): string {
    return this.config.defaultModel;
  }

  supportsModel(model: string): boolean {
    return this.config.models.includes(model);
  }

  protected buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
  }

  protected buildBaseUrl(): string {
    return this.config.baseUrl || '';
  }

  protected createResponse(
    requestId: string,
    content: string,
    model: string,
    finishReason: string,
    usage: TokenUsage,
    latencyMs: number,
  ): LLMResponse {
    return {
      id: generateId(),
      requestId,
      content,
      model,
      provider: this.config.provider,
      finishReason,
      usage,
      latencyMs,
      metadata: {},
      timestamp: new Date(),
    };
  }

  protected createStreamChunk(
    requestId: string,
    delta: string,
    model: string,
    finishReason: string | null,
    usage?: Partial<TokenUsage>,
  ): LLMStreamChunk {
    return {
      id: generateId(),
      requestId,
      content: delta,
      delta,
      model,
      provider: this.config.provider,
      finishReason,
      usage,
      timestamp: new Date(),
    };
  }

  protected async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number = this.config.timeout,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  protected parseJsonResponse<T>(response: Response): Promise<T> {
    return response.json() as Promise<T>;
  }

  protected handleError(error: unknown, requestId: string): never {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request ${requestId} timed out after ${this.config.timeout}ms`);
      }
      throw error;
    }
    throw new Error(`Unknown error for request ${requestId}: ${String(error)}`);
  }
}
