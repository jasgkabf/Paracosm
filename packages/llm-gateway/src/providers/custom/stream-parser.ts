import { createLogger } from '@paracosm/shared';

const logger = createLogger('StreamParser');

export interface StreamParseResult {
  content: string;
  finishReason: string | null;
  done: boolean;
}

export class StreamParser {
  private contentField: string;
  private finishReasonField: string;
  private doneSignal: string;
  private dataPrefix: string;

  constructor(options: {
    contentField?: string;
    finishReasonField?: string;
    doneSignal?: string;
    dataPrefix?: string;
  } = {}) {
    this.contentField = options.contentField || 'choices.0.delta.content';
    this.finishReasonField = options.finishReasonField || 'choices.0.finish_reason';
    this.doneSignal = options.doneSignal || '[DONE]';
    this.dataPrefix = options.dataPrefix || 'data: ';
  }

  parseLine(line: string): StreamParseResult | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    if (trimmed === `data: ${this.doneSignal}` || trimmed === this.doneSignal) {
      return { content: '', finishReason: 'stop', done: true };
    }

    const dataStr = trimmed.startsWith(this.dataPrefix)
      ? trimmed.slice(this.dataPrefix.length)
      : trimmed;

    if (!dataStr || dataStr === this.doneSignal) {
      return { content: '', finishReason: null, done: true };
    }

    try {
      const parsed = JSON.parse(dataStr) as Record<string, unknown>;
      return this.extractFromParsed(parsed);
    } catch {
      return null;
    }
  }

  parseSSEChunk(chunk: string): StreamParseResult[] {
    const results: StreamParseResult[] = [];
    const lines = chunk.split('\n');

    for (const line of lines) {
      const result = this.parseLine(line);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  private extractFromParsed(data: Record<string, unknown>): StreamParseResult {
    const content = this.getNestedField(data, this.contentField);
    const finishReason = this.getNestedField(data, this.finishReasonField);

    return {
      content: typeof content === 'string' ? content : '',
      finishReason: typeof finishReason === 'string' ? finishReason : null,
      done: false,
    };
  }

  private getNestedField(obj: Record<string, unknown>, path: string): unknown {
    if (!path) return undefined;
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      const numPart = parseInt(part, 10);
      if (!isNaN(numPart) && Array.isArray(current)) {
        current = current[numPart];
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    }
    return current;
  }
}
