import type { ResponseMapping, TokenUsage } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('ResponseMapper');

export class ResponseMapper {
  private mapping: ResponseMapping;

  constructor(mapping: ResponseMapping) {
    this.mapping = mapping;
  }

  extractContent(data: Record<string, unknown>): string {
    const content = this.getNestedField(data, this.mapping.contentField);
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((item) => {
          if (typeof item.text === 'string') return item.text;
          if (typeof item.content === 'string') return item.content;
          return '';
        })
        .filter((s) => s.length > 0)
        .join('');
    }
    return String(content ?? '');
  }

  extractModel(data: Record<string, unknown>): string | null {
    const model = this.getNestedField(data, this.mapping.modelField);
    return typeof model === 'string' ? model : null;
  }

  extractFinishReason(data: Record<string, unknown>): string | null {
    const reason = this.getNestedField(data, this.mapping.finishReasonField);
    return typeof reason === 'string' ? reason : null;
  }

  extractUsage(data: Record<string, unknown>): TokenUsage {
    const usageObj = this.mapping.usageField
      ? this.getNestedField(data, this.mapping.usageField)
      : data;

    if (typeof usageObj !== 'object' || usageObj === null) {
      return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    }

    const usage = usageObj as Record<string, unknown>;

    const promptTokens = this.getNestedField(usage, this.mapping.promptTokensField);
    const completionTokens = this.getNestedField(usage, this.mapping.completionTokensField);
    const totalTokens = this.getNestedField(usage, this.mapping.totalTokensField);

    const pT = typeof promptTokens === 'number' ? promptTokens : 0;
    const cT = typeof completionTokens === 'number' ? completionTokens : 0;
    const tT = typeof totalTokens === 'number' ? totalTokens : pT + cT;

    return {
      promptTokens: pT,
      completionTokens: cT,
      totalTokens: tT,
    };
  }

  extractError(responseBody: string): string {
    try {
      const data = JSON.parse(responseBody) as Record<string, unknown>;
      const error = this.getNestedField(data, this.mapping.errorField);
      const errorMessage = this.getNestedField(data, this.mapping.errorMessageField);

      if (typeof errorMessage === 'string') return errorMessage;
      if (typeof error === 'string') return error;
      if (typeof error === 'object' && error !== null) {
        const errObj = error as Record<string, unknown>;
        if (typeof errObj.message === 'string') return errObj.message;
      }

      return responseBody.substring(0, 200);
    } catch {
      return responseBody.substring(0, 200);
    }
  }

  updateMapping(mapping: Partial<ResponseMapping>): void {
    this.mapping = { ...this.mapping, ...mapping };
  }

  getMapping(): ResponseMapping {
    return { ...this.mapping };
  }

  private getNestedField(obj: Record<string, unknown>, path: string): unknown {
    if (!path || path.length === 0) return undefined;

    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }
}
