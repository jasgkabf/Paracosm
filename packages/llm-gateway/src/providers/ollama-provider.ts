import type { LLMRequest, LLMResponse, LLMStreamChunk } from '@paracosm/shared';
import { BaseProvider, type ProviderCapabilities, type ProviderRequestOptions } from './base-provider.js';

export class OllamaProvider extends BaseProvider {
  get name(): string {
    return 'ollama';
  }

  get capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      functionCalling: false,
      vision: false,
      audio: false,
      embeddings: true,
      maxContextTokens: 32768,
      maxOutputTokens: 4096,
    };
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: options?.signal,
        },
        options?.timeout ?? 120000,
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Ollama API error ${response.status}: ${errorBody}`);
      }

      const data = await this.parseJsonResponse<OllamaChatResponse>(response);
      const latencyMs = Date.now() - startTime;

      return this.createResponse(
        request.id,
        data.message?.content ?? '',
        data.model,
        data.done ? 'stop' : 'incomplete',
        {
          promptTokens: data.prompt_eval_count ?? 0,
          completionTokens: data.eval_count ?? 0,
          totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: options?.signal,
      },
      options?.timeout ?? 120000,
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Ollama API error ${response.status}: ${errorBody}`);
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

          try {
            const chunk = JSON.parse(trimmed);
            const delta = chunk.message?.content ?? '';
            const finishReason = chunk.done ? 'stop' : null;

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

  protected override buildBaseUrl(): string {
    return this.config.baseUrl || 'http://localhost:11434/v1';
  }

  private buildRequestBody(request: LLMRequest): OllamaChatRequest {
    const messages: Array<{ role: string; content: string }> = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    messages.push({ role: 'user', content: request.prompt });

    return {
      model: request.model,
      messages,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens ?? 4096,
        top_p: request.topP ?? 1,
      },
    };
  }
}

interface OllamaChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  options?: {
    temperature?: number;
    num_predict?: number;
    top_p?: number;
  };
  stream?: boolean;
}

interface OllamaChatResponse {
  model: string;
  message?: { role: string; content: string };
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}
