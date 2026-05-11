import { createLogger } from '@paracosm/shared';

const logger = createLogger('TokenEstimator');

export interface TokenEstimate {
  tokens: number;
  characters: number;
  words: number;
  sentences: number;
  estimatedBy: string;
}

export class TokenEstimator {
  private readonly CHARS_PER_TOKEN_ENGLISH = 4;
  private readonly CHARS_PER_TOKEN_CODE = 3.5;
  private readonly CHARS_PER_TOKEN_CJK = 2;
  private readonly WORDS_PER_TOKEN = 0.75;

  estimateTokens(text: string): number {
    if (!text || text.length === 0) return 0;

    const isCode = this.isCodeLike(text);
    const hasCJK = this.hasCJKCharacters(text);

    let estimate: number;

    if (hasCJK) {
      estimate = Math.ceil(text.length / this.CHARS_PER_TOKEN_CJK);
    } else if (isCode) {
      estimate = Math.ceil(text.length / this.CHARS_PER_TOKEN_CODE);
    } else {
      const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
      const charEstimate = Math.ceil(text.length / this.CHARS_PER_TOKEN_ENGLISH);
      const wordEstimate = Math.ceil(wordCount / this.WORDS_PER_TOKEN);
      estimate = Math.round((charEstimate + wordEstimate) / 2);
    }

    return Math.max(1, estimate);
  }

  estimateDetailed(text: string): TokenEstimate {
    const characters = text.length;
    const words = text.split(/\s+/).filter((w) => w.length > 0).length;
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;

    return {
      tokens: this.estimateTokens(text),
      characters,
      words,
      sentences,
      estimatedBy: this.isCodeLike(text) ? 'code_heuristic' : this.hasCJKCharacters(text) ? 'cjk_heuristic' : 'english_heuristic',
    };
  }

  estimateChatTokens(
    messages: Array<{ role: string; content: string }>,
  ): number {
    let total = 0;

    for (const message of messages) {
      total += 4;
      total += this.estimateTokens(message.role);
      total += this.estimateTokens(message.content);
      if (message.role === 'function') {
        total += 2;
      }
    }

    total += 2;
    return total;
  }

  estimateFunctionCallTokens(
    name: string,
    description: string,
    parameters: Record<string, unknown>,
  ): number {
    let tokens = 0;
    tokens += this.estimateTokens(name);
    tokens += this.estimateTokens(description);
    tokens += this.estimateTokens(JSON.stringify(parameters));
    tokens += 10;
    return tokens;
  }

  estimateStreamingOverhead(baseTokens: number): number {
    return Math.ceil(baseTokens * 0.02);
  }

  estimateSystemPromptTokens(systemPrompt: string): number {
    return this.estimateTokens(systemPrompt) + 4;
  }

  private isCodeLike(text: string): boolean {
    const codeIndicators = [
      /function\s+\w+/,
      /const\s+\w+/,
      /let\s+\w+/,
      /var\s+\w+/,
      /class\s+\w+/,
      /import\s+/,
      /export\s+/,
      /return\s+/,
      /\{[\s\S]*\}/,
      /\w+\.\w+\(/,
      /=>/,
      /===/,
      /!==/,
      /&gt;/,
      /&lt;/,
      /def\s+\w+/,
      /print\s*\(/,
    ];

    let indicatorCount = 0;
    for (const pattern of codeIndicators) {
      if (pattern.test(text)) {
        indicatorCount++;
      }
    }

    return indicatorCount >= 2;
  }

  private hasCJKCharacters(text: string): boolean {
    return /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(text);
  }
}
