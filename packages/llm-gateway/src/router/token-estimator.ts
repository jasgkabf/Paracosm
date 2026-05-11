import type { LLMRequest, LLMMessage } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";

const logger = new Logger("TokenEstimator");

const TOKEN_RATIOS: Record<string, number> = {
  default: 4,
  "gpt-4": 3.5,
  "gpt-4o": 3.5,
  "gpt-4-turbo": 3.5,
  "gpt-3.5-turbo": 4,
  "claude": 3.5,
  "gemini": 4,
  "deepseek": 3.5,
  "llama": 4,
  "mistral": 4,
  "moonshot": 4,
};

export class TokenEstimator {
  estimate(request: LLMRequest): { input: number; output: number; total: number } {
    const inputTokens = this.estimateFromMessages(request.messages).total;
    const outputTokens = Math.min(request.maxTokens, 4096);
    return {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
    };
  }

  estimateFromMessages(messages: LLMMessage[]): { input: number; output: number; total: number } {
    let total = 0;
    for (const message of messages) {
      total += this.estimateMessageTokens(message);
    }
    total += messages.length * 4;
    total += 3;
    return { input: total, output: 0, total };
  }

  estimateMessageTokens(message: LLMMessage): number {
    let tokens = 0;
    tokens += Math.ceil(message.content.length / TOKEN_RATIOS.default);
    tokens += 4;
    if (message.name) {
      tokens += Math.ceil(message.name.length / TOKEN_RATIOS.default) + 1;
    }
    if (message.functionCall) {
      tokens += Math.ceil(message.functionCall.name.length / TOKEN_RATIOS.default) + 2;
      tokens += Math.ceil(message.functionCall.arguments.length / TOKEN_RATIOS.default) + 2;
    }
    return tokens;
  }

  countExact(text: string, modelId?: string): number {
    const ratio = this.getRatioByModel(modelId);
    return Math.ceil(text.length / ratio);
  }

  ratioByModel(modelId?: string): number {
    return this.getRatioByModel(modelId);
  }

  private getRatioByModel(modelId?: string): number {
    if (!modelId) {
      return TOKEN_RATIOS.default;
    }
    const lowerModelId = modelId.toLowerCase();
    for (const [key, ratio] of Object.entries(TOKEN_RATIOS)) {
      if (lowerModelId.includes(key)) {
        return ratio;
      }
    }
    return TOKEN_RATIOS.default;
  }
}
