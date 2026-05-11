import type { MemoryEntry } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';
import type { ContextWindow } from './types.js';

const logger = createLogger('ContextWindowOptimizer');

export class ContextWindowOptimizer {
  private maxTokens: number;
  private tokensPerChar: number = 0.25;

  constructor(maxTokens: number = 8000) {
    this.maxTokens = maxTokens;
  }

  optimize(entries: MemoryEntry[], priorities?: Map<string, number>): ContextWindow {
    const scored = entries.map((entry) => {
      const priority = priorities?.get(entry.id) ?? 0;
      const recency = this.computeRecency(entry);
      const importance = entry.importance ?? 0;
      const accessFrequency = Math.min(entry.accessCount / 10, 1);
      const score = priority * 0.3 + recency * 0.25 + importance * 0.3 + accessFrequency * 0.15;
      return { entry, score, tokens: this.estimateTokens(entry.content) };
    });
    scored.sort((a, b) => b.score - a.score);
    const selected: MemoryEntry[] = [];
    let totalTokens = 0;
    for (const item of scored) {
      if (totalTokens + item.tokens <= this.maxTokens) {
        selected.push(item.entry);
        totalTokens += item.tokens;
      }
    }
    return {
      entries: selected,
      totalTokens,
      maxTokens: this.maxTokens,
      utilization: totalTokens / this.maxTokens,
    };
  }

  private computeRecency(entry: MemoryEntry): number {
    const ageMs = Date.now() - entry.createdAt.getTime();
    const ageHours = ageMs / 3600000;
    return Math.exp(-ageHours * 0.1);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length * this.tokensPerChar);
  }

  setMaxTokens(max: number): void {
    this.maxTokens = max;
  }

  getMaxTokens(): number {
    return this.maxTokens;
  }
}
