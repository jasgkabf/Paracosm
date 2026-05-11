import type { LLMRequest, RequestMapping } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('RequestMapper');

export class RequestMapper {
  private mapping: RequestMapping;

  constructor(mapping: RequestMapping) {
    this.mapping = mapping;
  }

  map(request: LLMRequest): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    this.setNestedField(result, this.mapping.modelField, request.model);
    this.setNestedField(result, this.mapping.promptField, request.prompt);

    if (request.systemPrompt) {
      this.setNestedField(result, this.mapping.systemPromptField, request.systemPrompt);
    }

    if (request.temperature !== undefined) {
      this.setNestedField(result, this.mapping.temperatureField, request.temperature);
    }

    if (request.maxTokens !== undefined) {
      this.setNestedField(result, this.mapping.maxTokensField, request.maxTokens);
    }

    if (request.topP !== undefined) {
      this.setNestedField(result, this.mapping.topPField, request.topP);
    }

    if (request.stopSequences && request.stopSequences.length > 0) {
      this.setNestedField(result, this.mapping.stopSequencesField, request.stopSequences);
    }

    if (this.mapping.extraFields) {
      for (const [key, value] of Object.entries(this.mapping.extraFields)) {
        result[key] = value;
      }
    }

    return result;
  }

  mapMessages(messages: Array<{ role: string; content: string }>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    this.setNestedField(result, this.mapping.modelField, '');
    this.setNestedField(result, 'messages', messages);
    return result;
  }

  updateMapping(mapping: Partial<RequestMapping>): void {
    this.mapping = { ...this.mapping, ...mapping };
  }

  getMapping(): RequestMapping {
    return { ...this.mapping };
  }

  private setNestedField(obj: Record<string, unknown>, path: string, value: unknown): void {
    if (!path || path.length === 0) return;

    const parts = path.split('.');
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }
}
