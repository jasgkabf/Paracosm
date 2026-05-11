import { MODEL_CAPABILITIES } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('ContextFitter');

export interface ContextFitResult {
  fits: boolean;
  totalTokens: number;
  contextWindow: number;
  utilization: number;
  trimmedPrompt?: string;
  trimmedSystemPrompt?: string;
  removedMessages: number;
  strategy: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  tokens: number;
}

export class ContextFitter {
  private tokenEstimator: { estimateTokens(text: string): number };

  constructor(tokenEstimator?: { estimateTokens(text: string): number }) {
    this.tokenEstimator = tokenEstimator || {
      estimateTokens: (text: string) => Math.ceil(text.length / 4),
    };
  }

  fitContext(
    prompt: string,
    systemPrompt: string | undefined,
    model: string,
    maxOutputTokens: number = 4096,
    messages?: Message[],
  ): ContextFitResult {
    const capabilities = MODEL_CAPABILITIES[model as keyof typeof MODEL_CAPABILITIES];
    const contextWindow = capabilities?.contextWindow ?? 4096;
    const availableForInput = contextWindow - maxOutputTokens;

    const promptTokens = this.tokenEstimator.estimateTokens(prompt);
    const systemTokens = systemPrompt
      ? this.tokenEstimator.estimateTokens(systemPrompt)
      : 0;
    const messageTokens = messages
      ? messages.reduce((sum, m) => sum + m.tokens, 0)
      : 0;

    const totalTokens = promptTokens + systemTokens + messageTokens;

    if (totalTokens <= availableForInput) {
      return {
        fits: true,
        totalTokens,
        contextWindow,
        utilization: totalTokens / contextWindow,
        removedMessages: 0,
        strategy: 'none',
      };
    }

    const result = this.trimToFit(
      prompt,
      systemPrompt,
      promptTokens,
      systemTokens,
      messages,
      availableForInput,
      contextWindow,
    );

    return result;
  }

  private trimToFit(
    prompt: string,
    systemPrompt: string | undefined,
    promptTokens: number,
    systemTokens: number,
    messages: Message[] | undefined,
    availableForInput: number,
    contextWindow: number,
  ): ContextFitResult {
    let trimmedSystemPrompt = systemPrompt;
    let currentSystemTokens = systemTokens;
    let currentMessages = messages ? [...messages] : [];
    let removedMessages = 0;
    let strategy = 'none';

    const reservedForPrompt = promptTokens;
    const remainingAfterPrompt = availableForInput - reservedForPrompt;

    if (currentSystemTokens + (currentMessages.reduce((s, m) => s + m.tokens, 0)) <= remainingAfterPrompt) {
      return {
        fits: true,
        totalTokens: promptTokens + currentSystemTokens + currentMessages.reduce((s, m) => s + m.tokens, 0),
        contextWindow,
        utilization: (promptTokens + currentSystemTokens + currentMessages.reduce((s, m) => s + m.tokens, 0)) / contextWindow,
        removedMessages: 0,
        strategy: 'none',
      };
    }

    if (currentMessages.length > 0) {
      strategy = 'remove_oldest';
      while (currentMessages.length > 0) {
        const messageTokens = currentMessages.reduce((s, m) => s + m.tokens, 0);
        if (currentSystemTokens + messageTokens <= remainingAfterPrompt) {
          break;
        }
        currentMessages.shift();
        removedMessages++;
      }
    }

    const messageTokensAfterTrim = currentMessages.reduce((s, m) => s + m.tokens, 0);

    if (currentSystemTokens + messageTokensAfterTrim > remainingAfterPrompt && trimmedSystemPrompt) {
      strategy = 'truncate_system';
      const maxSystemTokens = remainingAfterPrompt - messageTokensAfterTrim;
      if (maxSystemTokens > 100) {
        const ratio = maxSystemTokens / currentSystemTokens;
        const targetLength = Math.floor(trimmedSystemPrompt.length * ratio);
        trimmedSystemPrompt = trimmedSystemPrompt.substring(0, targetLength) + '...';
        currentSystemTokens = this.tokenEstimator.estimateTokens(trimmedSystemPrompt);
      } else {
        trimmedSystemPrompt = undefined;
        currentSystemTokens = 0;
      }
    }

    const finalTokens = promptTokens + currentSystemTokens + messageTokensAfterTrim;

    return {
      fits: finalTokens <= availableForInput,
      totalTokens: finalTokens,
      contextWindow,
      utilization: finalTokens / contextWindow,
      trimmedPrompt: prompt,
      trimmedSystemPrompt,
      removedMessages,
      strategy,
    };
  }

  summarizeMessages(messages: Message[], targetTokens: number): Message[] {
    if (messages.length === 0) return [];

    const totalTokens = messages.reduce((s, m) => s + m.tokens, 0);
    if (totalTokens <= targetTokens) return messages;

    const result: Message[] = [];
    let usedTokens = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (usedTokens + msg.tokens <= targetTokens) {
        result.unshift(msg);
        usedTokens += msg.tokens;
      } else {
        const remaining = targetTokens - usedTokens;
        if (remaining > 50) {
          const ratio = remaining / msg.tokens;
          const truncated = msg.content.substring(0, Math.floor(msg.content.length * ratio)) + '...';
          result.unshift({
            role: msg.role,
            content: truncated,
            tokens: this.tokenEstimator.estimateTokens(truncated),
          });
        }
        break;
      }
    }

    return result;
  }

  getContextUtilization(
    prompt: string,
    systemPrompt: string | undefined,
    model: string,
    maxOutputTokens: number = 4096,
  ): number {
    const capabilities = MODEL_CAPABILITIES[model as keyof typeof MODEL_CAPABILITIES];
    const contextWindow = capabilities?.contextWindow ?? 4096;
    const availableForInput = contextWindow - maxOutputTokens;

    const promptTokens = this.tokenEstimator.estimateTokens(prompt);
    const systemTokens = systemPrompt
      ? this.tokenEstimator.estimateTokens(systemPrompt)
      : 0;

    return (promptTokens + systemTokens) / availableForInput;
  }
}
