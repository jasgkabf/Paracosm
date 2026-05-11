import type { LLMModel, LLMMessage } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";
import { TokenEstimator } from "./token-estimator.js";

const logger = new Logger("ContextFitter");

interface MessageTokenCount {
  role: string;
  contentLength: number;
  estimatedTokens: number;
  index: number;
}

export class ContextFitter {
  private tokenEstimator: TokenEstimator;

  constructor() {
    this.tokenEstimator = new TokenEstimator();
  }

  fitToWindow(models: LLMModel[], messages: LLMMessage[]): LLMModel[] {
    const totalTokens = this.tokenEstimator.estimateFromMessages(messages);
    return models.filter((model) => {
      const availableForOutput = model.contextWindow - totalTokens.total;
      return availableForOutput > 0 && model.capabilities.maxInputTokens >= totalTokens.total;
    });
  }

  selectMessages(messages: LLMMessage[], maxTokens: number, strategy: "recent" | "important" | "balanced" = "balanced"): LLMMessage[] {
    const messageTokens = messages.map((m, index) => ({
      role: m.role,
      contentLength: m.content.length,
      estimatedTokens: this.tokenEstimator.estimateMessageTokens(m),
      index,
    }));

    const totalTokens = messageTokens.reduce((sum, m) => sum + m.estimatedTokens, 0);
    if (totalTokens <= maxTokens) {
      return [...messages];
    }

    switch (strategy) {
      case "recent":
        return this.selectRecent(messages, messageTokens, maxTokens);
      case "important":
        return this.selectImportant(messages, messageTokens, maxTokens);
      case "balanced":
        return this.selectBalanced(messages, messageTokens, maxTokens);
      default:
        return this.selectBalanced(messages, messageTokens, maxTokens);
    }
  }

  compressHistory(messages: LLMMessage[], maxTokens: number): LLMMessage[] {
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const systemTokens = systemMessages.reduce((sum, m) => sum + this.tokenEstimator.estimateMessageTokens(m), 0);
    const remainingTokens = maxTokens - systemTokens;

    if (remainingTokens <= 0) {
      return systemMessages.slice(0, 1);
    }

    const recentCount = Math.max(1, Math.floor(nonSystemMessages.length * 0.3));
    const recentMessages = nonSystemMessages.slice(-recentCount);
    const olderMessages = nonSystemMessages.slice(0, -recentCount);

    const recentTokens = recentMessages.reduce((sum, m) => sum + this.tokenEstimator.estimateMessageTokens(m), 0);
    const tokensForOlder = remainingTokens - recentTokens;

    if (tokensForOlder <= 0) {
      return [...systemMessages, ...recentMessages];
    }

    const compressedOlder = this.summarizeMessages(olderMessages, tokensForOlder);
    return [...systemMessages, ...compressedOlder, ...recentMessages];
  }

  private selectRecent(messages: LLMMessage[], tokens: MessageTokenCount[], maxTokens: number): LLMMessage[] {
    const selected: LLMMessage[] = [];
    let usedTokens = 0;

    const systemMessages = messages.filter((m) => m.role === "system");
    const systemTokens = tokens.filter((t) => t.role === "system").reduce((s, t) => s + t.estimatedTokens, 0);
    usedTokens += systemTokens;
    selected.push(...systemMessages);

    const nonSystem = messages.filter((m) => m.role !== "system");
    for (let i = nonSystem.length - 1; i >= 0; i--) {
      const msg = nonSystem[i];
      const msgTokens = this.tokenEstimator.estimateMessageTokens(msg);
      if (usedTokens + msgTokens <= maxTokens) {
        selected.splice(systemMessages.length, 0, msg);
        usedTokens += msgTokens;
      } else {
        break;
      }
    }

    return selected;
  }

  private selectImportant(messages: LLMMessage[], tokens: MessageTokenCount[], maxTokens: number): LLMMessage[] {
    const scored = messages.map((msg, index) => ({
      message: msg,
      index,
      score: this.scoreImportance(msg, index, messages.length),
      tokens: this.tokenEstimator.estimateMessageTokens(msg),
    }));

    scored.sort((a, b) => b.score - a.score);

    const selected: { message: LLMMessage; index: number }[] = [];
    let usedTokens = 0;

    for (const item of scored) {
      if (usedTokens + item.tokens <= maxTokens) {
        selected.push({ message: item.message, index: item.index });
        usedTokens += item.tokens;
      }
    }

    selected.sort((a, b) => a.index - b.index);
    return selected.map((s) => s.message);
  }

  private selectBalanced(messages: LLMMessage[], tokens: MessageTokenCount[], maxTokens: number): LLMMessage[] {
    const systemMessages = messages.filter((m) => m.role === "system");
    let usedTokens = systemMessages.reduce((s, m) => s + this.tokenEstimator.estimateMessageTokens(m), 0);

    const result: LLMMessage[] = [...systemMessages];
    const nonSystem = messages.filter((m) => m.role !== "system");

    if (nonSystem.length <= 1) {
      return messages;
    }

    const firstUserMsg = nonSystem.find((m) => m.role === "user");
    const lastUserMsg = [...nonSystem].reverse().find((m) => m.role === "user");
    const lastAssistantMsg = [...nonSystem].reverse().find((m) => m.role === "assistant");

    const importantIndices = new Set<number>();
    if (firstUserMsg) importantIndices.add(nonSystem.indexOf(firstUserMsg));
    if (lastUserMsg) importantIndices.add(nonSystem.indexOf(lastUserMsg));
    if (lastAssistantMsg) importantIndices.add(nonSystem.indexOf(lastAssistantMsg));

    for (const idx of importantIndices) {
      const msg = nonSystem[idx];
      const msgTokens = this.tokenEstimator.estimateMessageTokens(msg);
      if (usedTokens + msgTokens <= maxTokens) {
        usedTokens += msgTokens;
      }
    }

    for (let i = nonSystem.length - 1; i >= 0; i--) {
      const msg = nonSystem[i];
      const msgTokens = this.tokenEstimator.estimateMessageTokens(msg);
      if (usedTokens + msgTokens <= maxTokens) {
        result.push(msg);
        usedTokens += msgTokens;
      }
    }

    return result;
  }

  private scoreImportance(message: LLMMessage, index: number, total: number): number {
    let score = 0;
    if (message.role === "system") score += 10;
    if (message.role === "user") score += 5;
    if (message.role === "assistant") score += 3;
    if (message.functionCall) score += 4;

    const recency = index / total;
    score += recency * 5;

    if (message.content.length > 500) score += 2;
    if (message.content.includes("important") || message.content.includes("critical")) score += 3;

    return score;
  }

  private summarizeMessages(messages: LLMMessage[], maxTokens: number): LLMMessage[] {
    if (messages.length === 0) {
      return [];
    }

    const totalContent = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
    const summaryMaxChars = Math.floor(maxTokens * 4);
    const truncated = totalContent.length > summaryMaxChars
      ? totalContent.substring(0, summaryMaxChars) + "..."
      : totalContent;

    return [{
      role: "system",
      content: `[Conversation summary]: ${truncated}`,
    }];
  }
}
