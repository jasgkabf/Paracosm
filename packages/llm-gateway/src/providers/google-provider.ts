import type { LLMRequest, LLMResponse, LLMStreamChunk } from '@paracosm/shared';
import { BaseProvider, type ProviderCapabilities, type ProviderRequestOptions } from './base-provider.js';

export class GoogleProvider extends BaseProvider {
  get name(): string {
    return 'google';
  }

  get capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      functionCalling: true,
      vision: true,
      audio: false,
      embeddings: true,
      maxContextTokens: 1000000,
      maxOutputTokens: 8192,
    };
  }

  async complete(request: LLMRequest, options?: ProviderRequestOptions): Promise<LLMResponse> {
    const startTime = Date.now();
    const url = `${this.buildBaseUrl()}/models/${request.model}:generateContent?key=${this.config.apiKey}`;

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
        options?.timeout ?? this.config.timeout,
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Google API error ${response.status}: ${errorBody}`);
      }

      const data = await this.parseJsonResponse<GoogleGenerateResponse>(response);
      const latencyMs = Date.now() - startTime;

      const content = data.candidates?.[0]?.content?.parts
        ?.filter((p) => p.text)
        .map((p) => p.text)
        .join('') ?? '';

      const usage = data.usageMetadata;

      return this.createResponse(
        request.id,
        content,
        request.model,
        data.candidates?.[0]?.finishReason ?? 'STOP',
        {
          promptTokens: usage?.promptTokenCount ?? 0,
          completionTokens: usage?.candidatesTokenCount ?? 0,
          totalTokens: usage?.totalTokenCount ?? 0,
        },
        latencyMs,
      );
    } catch (error) {
      this.handleError(error, request.id);
    }
  }

  async *stream(request: LLMRequest, options?: ProviderRequestOptions): AsyncIterable<LLMStreamChunk> {
    const url = `${this.buildBaseUrl()}/models/${request.model}:streamGenerateContent?alt=sse&key=${this.config.apiKey}`;
    const body = this.buildRequestBody(request);

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: options?.signal,
      },
      options?.timeout ?? this.config.timeout,
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Google API error ${response.status}: ${errorBody}`);
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
            const chunk = JSON.parse(trimmed.slice(6));
            const delta = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            const finishReason = chunk.candidates?.[0]?.finishReason ?? null;

            yield this.createStreamChunk(request.id, delta, request.model, finishReason);
          } catch {
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private buildRequestBody(request: LLMRequest): GoogleGenerateRequest {
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    contents.push({
      role: 'user',
      parts: [{ text: request.prompt }],
    });

    const generationConfig: Record<string, unknown> = {
      temperature: request.temperature ?? 0.7,
      maxOutputTokens: request.maxTokens ?? 4096,
      topP: request.topP ?? 1,
      stopSequences: request.stopSequences,
    };

    return {
      contents,
      systemInstruction: request.systemPrompt
        ? { parts: [{ text: request.systemPrompt }] }
        : undefined,
      generationConfig,
    };
  }
}

interface GoogleGenerateRequest {
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  systemInstruction?: { parts: Array<{ text: string }> };
  generationConfig: Record<string, unknown>;
}

interface GoogleGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}
