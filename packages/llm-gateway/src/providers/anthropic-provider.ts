import type { LLMRequest, LLMResponse, LLMStreamChunk } from '@paracosm/shared';
import { BaseProvider, type ProviderCapabilities, type ProviderRequestOptions } from './base-provider.js';

export class AnthropicProvider extends BaseProvider {
  get name(): string {
    return 'anthropic';
  }

  get capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      functionCalling: true,
      vision: true,
      audio: false,
      embeddings: false,
      maxContextTokens: 200000,
      maxOutputTokens: 8192,
    };
  }

  async complete(request: LLMRequest, options?: ProviderRequestOptions): Promise<LLMResponse> {
    const startTime = Date.now();
    const url = `${this.buildBaseUrl()}/messages`;

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
        throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
      }

      const data = await this.parseJsonResponse<AnthropicMessagesResponse>(response);
      const latencyMs = Date.now() - startTime;

      const content = data.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return this.createResponse(
        request.id,
        content,
        data.model,
        data.stop_reason ?? 'end_turn',
        {
          promptTokens: data.usage?.input_tokens ?? 0,
          completionTokens: data.usage?.output_tokens ?? 0,
          totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
        },
        latencyMs,
      );
    } catch (error) {
      this.handleError(error, request.id);
    }
  }

  async *stream(request: LLMRequest, options?: ProviderRequestOptions): AsyncIterable<LLMStreamChunk> {
    const url = `${this.buildBaseUrl()}/messages`;
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
      throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
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
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const event = JSON.parse(trimmed.slice(6));

            if (event.type === 'content_block_delta') {
              const delta = event.delta?.text ?? '';
              yield this.createStreamChunk(request.id, delta, request.model, null);
            } else if (event.type === 'message_stop') {
              yield this.createStreamChunk(request.id, '', request.model, 'end_turn');
            } else if (event.type === 'message_delta' && event.usage) {
              yield this.createStreamChunk(request.id, '', request.model, event.delta?.stop_reason ?? null, {
                completionTokens: event.usage.output_tokens,
              });
            }
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
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  private buildRequestBody(request: LLMRequest): AnthropicMessagesRequest {
    const messages: Array<{ role: string; content: string }> = [];
    messages.push({ role: 'user', content: request.prompt });

    return {
      model: request.model,
      max_tokens: request.maxTokens ?? 4096,
      messages,
      system: request.systemPrompt,
      temperature: request.temperature ?? 0.7,
      top_p: request.topP,
      stop_sequences: request.stopSequences,
    };
  }
}

interface AnthropicMessagesRequest {
  model: string;
  max_tokens: number;
  messages: Array<{ role: string; content: string }>;
  system?: string;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
  stream?: boolean;
}

interface AnthropicMessagesResponse {
  id: string;
  type: string;
  role: string;
  model: string;
  content: Array<{ type: string; text: string }>;
  stop_reason: string | null;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}
