import type { LLMRequest, LLMResponse, LLMStreamChunk, ProviderConfig } from '@paracosm/shared';
import { BaseProvider, type ProviderCapabilities, type ProviderRequestOptions } from './base-provider.js';

export class CustomOpenAIProvider extends BaseProvider {
  private customHeaders: Record<string, string>;

  get name(): string {
    return 'custom-openai';
  }

  get capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      functionCalling: true,
      vision: false,
      audio: false,
      embeddings: false,
      maxContextTokens: 128000,
      maxOutputTokens: 4096,
    };
  }

  constructor(config: ProviderConfig, customHeaders?: Record<string, string>) {
    super(config);
    this.customHeaders = customHeaders ?? {};
  }

  async complete(request: LLMRequest, options?: ProviderRequestOptions): Promise<LLMResponse> {
    const startTime = Date.now();
    const url = `${this.buildBaseUrl()}/chat/completions`;

    const body = this.buildRequestBody(request);

    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: this.buildHeaders(),
          body: JSON.stringify(body),
          signal: options?.signal,
        },
        options?.timeout ?? this.config.timeout,
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Custom OpenAI API error ${response.status}: ${errorBody}`);
      }

      const data = await this.parseJsonResponse<CustomOpenAIChatResponse>(response);
      const latencyMs = Date.now() - startTime;

      return this.createResponse(
        request.id,
        data.choices[0]?.message?.content ?? '',
        data.model ?? request.model,
        data.choices[0]?.finish_reason ?? 'stop',
        {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
        latencyMs,
      );
    } catch (error) {
      this.handleError(error, request.id);
    }
  }

  async *stream(request: LLMRequest, options?: ProviderRequestOptions): AsyncIterable<LLMStreamChunk> {
    const url = `${this.buildBaseUrl()}/chat/completions`;
    const body = { ...this.buildRequestBody(request), stream: true };

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: options?.signal,
      },
      options?.timeout ?? this.config.timeout,
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Custom OpenAI API error ${response.status}: ${errorBody}`);
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
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const chunk = JSON.parse(trimmed.slice(6));
            const delta = chunk.choices[0]?.delta?.content ?? '';
            const finishReason = chunk.choices[0]?.finish_reason ?? null;

            yield this.createStreamChunk(request.id, delta, chunk.model ?? request.model, finishReason);
          } catch {
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  protected override buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.customHeaders,
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  private buildRequestBody(request: LLMRequest): CustomOpenAIChatRequest {
    const messages: Array<{ role: string; content: string }> = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    messages.push({ role: 'user', content: request.prompt });

    return {
      model: request.model,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
      top_p: request.topP ?? 1,
      stop: request.stopSequences,
    };
  }
}

interface CustomOpenAIChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
}

interface CustomOpenAIChatResponse {
  id: string;
  model?: string;
  choices: Array<{
    index: number;
    message?: { role: string; content: string };
    delta?: { content?: string };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
