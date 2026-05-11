import type { MemoryEntry } from "@paracosm/shared";
import type { OptimizedContext, RankedEntry, MemoryEvents, MemoryEventName } from "./types.js";
import { cosineSimilarity, normalize } from "./vector-store/vector-utils.js";

type EventHandler = (data: unknown) => void;

export class ContextWindowOptimizer {
  private maxTokens: number;
  private tokensPerChar: number;
  private listeners: Map<string, Set<EventHandler>>;
  private embeddingDimension: number;

  constructor(maxTokens: number = 8000, embeddingDimension: number = 128) {
    this.maxTokens = maxTokens;
    this.tokensPerChar = 0.25;
    this.listeners = new Map();
    this.embeddingDimension = embeddingDimension;
  }

  optimize(context: MemoryEntry[], maxTokens?: number): OptimizedContext {
    const targetTokens = maxTokens ?? this.maxTokens;
    const totalTokens = this.estimateTokens(context);

    if (totalTokens <= targetTokens) {
      return {
        entries: context,
        totalTokens,
        maxTokens: targetTokens,
        utilizationRatio: totalTokens / targetTokens,
        prunedCount: 0,
        compressedCount: 0,
        strategy: "none",
      };
    }

    let optimized = this.prune(context, targetTokens);
    if (optimized.totalTokens <= targetTokens) {
      return optimized;
    }

    optimized = this.compress(context, targetTokens);
    return optimized;
  }

  select(entries: MemoryEntry[], query: string, maxTokens: number): MemoryEntry[] {
    const ranked = this.rank(entries, query);
    const selected = this.tokenBudget(
      ranked.map((r) => r.entry),
      maxTokens
    );
    return selected;
  }

  rank(entries: MemoryEntry[], query: string): RankedEntry[] {
    const queryEmbedding = this.embed(query);
    const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 0);

    const ranked: RankedEntry[] = entries.map((entry) => {
      const score = this.relevanceScore(entry, query);
      const reasons: string[] = [];

      if (entry.embedding) {
        const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
        if (similarity > 0.5) {
          reasons.push(`semantic similarity: ${similarity.toFixed(3)}`);
        }
      }

      const contentLower = entry.content.toLowerCase();
      const matchedTerms = queryTerms.filter((t) => contentLower.includes(t));
      if (matchedTerms.length > 0) {
        reasons.push(`text match: ${matchedTerms.join(", ")}`);
      }

      const tagMatches = entry.tags.filter((t) =>
        queryTerms.some((qt) => t.toLowerCase().includes(qt))
      );
      if (tagMatches.length > 0) {
        reasons.push(`tag match: ${tagMatches.join(", ")}`);
      }

      if (entry.importance > 0.7) {
        reasons.push("high importance");
      }

      const ageMs = Date.now() - new Date(entry.lastAccessedAt).getTime();
      if (ageMs < 3600000) {
        reasons.push("recently accessed");
      }

      return { entry, score, reasons };
    });

    ranked.sort((a, b) => b.score - a.score);
    return ranked;
  }

  prune(context: MemoryEntry[], targetTokens: number): OptimizedContext {
    const ranked = context
      .map((entry) => ({
        entry,
        score: this.computePruneScore(entry),
        tokenCount: this.estimateTokenCount(entry.content),
      }))
      .sort((a, b) => b.score - a.score);

    const selected: MemoryEntry[] = [];
    let totalTokens = 0;
    let prunedCount = 0;

    for (const item of ranked) {
      if (totalTokens + item.tokenCount <= targetTokens) {
        selected.push(item.entry);
        totalTokens += item.tokenCount;
      } else {
        prunedCount += 1;
      }
    }

    return {
      entries: selected,
      totalTokens,
      maxTokens: targetTokens,
      utilizationRatio: totalTokens / targetTokens,
      prunedCount,
      compressedCount: 0,
      strategy: "prune",
    };
  }

  compress(context: MemoryEntry[], targetTokens: number): OptimizedContext {
    const ranked = context
      .map((entry) => ({
        entry,
        score: this.computePruneScore(entry),
        tokenCount: this.estimateTokenCount(entry.content),
      }))
      .sort((a, b) => b.score - a.score);

    const highPriority: typeof ranked = [];
    const lowPriority: typeof ranked = [];
    const totalTokens = ranked.reduce((sum, r) => sum + r.tokenCount, 0);

    if (totalTokens <= targetTokens) {
      return {
        entries: context,
        totalTokens,
        maxTokens: targetTokens,
        utilizationRatio: totalTokens / targetTokens,
        prunedCount: 0,
        compressedCount: 0,
        strategy: "none",
      };
    }

    const midPoint = Math.ceil(ranked.length * 0.6);
    for (let i = 0; i < ranked.length; i++) {
      if (i < midPoint) {
        highPriority.push(ranked[i]);
      } else {
        lowPriority.push(ranked[i]);
      }
    }

    const highPriorityTokens = highPriority.reduce((sum, r) => sum + r.tokenCount, 0);
    const remainingBudget = targetTokens - highPriorityTokens;

    const compressedEntries: MemoryEntry[] = [];
    let compressedTokens = 0;
    let compressedCount = 0;

    if (remainingBudget > 0 && lowPriority.length > 0) {
      const lowPriorityContent = lowPriority.map((r) => r.entry);
      const summary = this.summarizeEntries(lowPriorityContent);

      const summaryTokens = this.estimateTokenCount(summary);
      if (summaryTokens <= remainingBudget) {
        const compressedEntry: MemoryEntry = {
          id: `compressed_${Date.now()}`,
          type: lowPriority[0].entry.type,
          content: summary,
          embedding: null,
          importance: Math.max(...lowPriority.map((r) => r.entry.importance)) * 0.8,
          accessCount: 0,
          lastAccessedAt: new Date().toISOString(),
          expiresAt: null,
          tags: [...new Set(lowPriority.flatMap((r) => r.entry.tags))],
          source: "compression",
          metadata: {
            compressedFrom: lowPriority.map((r) => r.entry.id),
            originalCount: lowPriority.length,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        compressedEntries.push(compressedEntry);
        compressedTokens = summaryTokens;
        compressedCount = lowPriority.length;
      }
    }

    const finalEntries = [
      ...highPriority.map((r) => r.entry),
      ...compressedEntries,
    ];
    const finalTokens = highPriorityTokens + compressedTokens;

    return {
      entries: finalEntries,
      totalTokens: finalTokens,
      maxTokens: targetTokens,
      utilizationRatio: finalTokens / targetTokens,
      prunedCount: 0,
      compressedCount,
      strategy: "compress",
    };
  }

  relevanceScore(entry: MemoryEntry, query: string): number {
    let score = 0;
    const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 0);

    const contentLower = entry.content.toLowerCase();
    let termMatchCount = 0;
    for (const term of queryTerms) {
      if (contentLower.includes(term)) {
        termMatchCount += 1;
      }
    }
    score += (termMatchCount / Math.max(queryTerms.length, 1)) * 0.35;

    if (entry.embedding) {
      const queryEmbedding = this.embed(query);
      const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
      score += similarity * 0.3;
    }

    score += entry.importance * 0.2;

    const now = Date.now();
    const ageMs = now - new Date(entry.lastAccessedAt).getTime();
    const recencyScore = Math.exp(-ageMs / 86400000);
    score += recencyScore * 0.1;

    const tagOverlap = entry.tags.filter((t) =>
      queryTerms.some((qt) => t.toLowerCase().includes(qt))
    ).length;
    score += (tagOverlap / Math.max(entry.tags.length, 1)) * 0.05;

    return Math.min(1, score);
  }

  tokenBudget(entries: MemoryEntry[], budget: number): MemoryEntry[] {
    const selected: MemoryEntry[] = [];
    let usedTokens = 0;

    for (const entry of entries) {
      const tokens = this.estimateTokenCount(entry.content);
      if (usedTokens + tokens <= budget) {
        selected.push(entry);
        usedTokens += tokens;
      }
    }

    return selected;
  }

  setMaxTokens(maxTokens: number): void {
    this.maxTokens = maxTokens;
  }

  getMaxTokens(): number {
    return this.maxTokens;
  }

  estimateTokenCount(text: string): number {
    return Math.ceil(text.length * this.tokensPerChar);
  }

  private estimateTokens(entries: MemoryEntry[]): number {
    return entries.reduce((sum, e) => sum + this.estimateTokenCount(e.content), 0);
  }

  private computePruneScore(entry: MemoryEntry): number {
    let score = 0;

    score += entry.importance * 0.4;

    const now = Date.now();
    const ageMs = now - new Date(entry.lastAccessedAt).getTime();
    const recencyScore = Math.exp(-ageMs / 86400000);
    score += recencyScore * 0.25;

    score += Math.min(entry.accessCount / 10, 1) * 0.2;

    score += (entry.tags.length / 10) * 0.05;

    const sourceReliability: Record<string, number> = {
      user: 1.0,
      system: 0.9,
      llm: 0.7,
      unknown: 0.5,
      compression: 0.4,
    };
    score += (sourceReliability[entry.source] ?? 0.5) * 0.1;

    return score;
  }

  private summarizeEntries(entries: MemoryEntry[]): string {
    if (entries.length === 0) return "";
    if (entries.length === 1) return entries[0].content;

    const allSentences: Array<{ text: string; score: number }> = [];

    for (const entry of entries) {
      const sentences = entry.content
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);

      for (const sentence of sentences) {
        let score = entry.importance * 0.5;
        const words = sentence.split(/\s+/);
        const uniqueWords = new Set(words);
        score += uniqueWords.size * 0.02;
        if (sentence.length > 30) score += 0.2;
        allSentences.push({ text: sentence, score });
      }
    }

    allSentences.sort((a, b) => b.score - a.score);
    const targetCount = Math.max(1, Math.ceil(allSentences.length * 0.25));
    const selected = allSentences.slice(0, targetCount);

    return selected.map((s) => s.text).join(". ") + ".";
  }

  private embed(text: string): number[] {
    const vector: number[] = [];
    const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    const seed = this.hashString(text);

    for (let i = 0; i < this.embeddingDimension; i++) {
      let val = 0;
      for (let j = 0; j < words.length; j++) {
        const charSum = this.hashString(words[j] + i + seed);
        val += Math.sin(charSum * (i + 1) * 0.001) * 0.5;
      }
      val /= Math.max(words.length, 1);
      vector.push(val);
    }

    return normalize(vector);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private emit(event: MemoryEventName, data: unknown): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch {
          continue;
        }
      }
    }
  }

  on(event: MemoryEventName, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: MemoryEventName, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }
}
