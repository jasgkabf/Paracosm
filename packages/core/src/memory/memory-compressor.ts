import type { MemoryEntry } from "@paracosm/shared";
import { generateId } from "@paracosm/shared";
import type { CompressedMemory, KeyPoint, QualityMetrics, MemoryEvents, MemoryEventName } from "./types.js";

type EventHandler = (data: unknown) => void;

export class MemoryCompressor {
  private listeners: Map<string, Set<EventHandler>>;
  private minCompressionRatio: number;
  private qualityThreshold: number;

  constructor(minCompressionRatio: number = 0.3, qualityThreshold: number = 0.8) {
    this.listeners = new Map();
    this.minCompressionRatio = minCompressionRatio;
    this.qualityThreshold = qualityThreshold;
  }

  compress(entries: MemoryEntry[]): CompressedMemory {
    if (entries.length === 0) {
      return {
        id: generateId(),
        originalIds: [],
        summary: "",
        keyPoints: [],
        compressionRatio: 0,
        createdAt: new Date().toISOString(),
      };
    }

    const summary = this.summarize(entries);
    const keyPoints = this.extract(entries);

    const originalContent = entries.reduce((sum, e) => sum + e.content.length, 0);
    const compressedContent = summary.length + keyPoints.reduce((sum, kp) => sum + kp.text.length, 0);
    const compressionRatio = originalContent > 0 ? compressedContent / originalContent : 0;

    const compressed: CompressedMemory = {
      id: generateId(),
      originalIds: entries.map((e) => e.id),
      summary,
      keyPoints,
      compressionRatio,
      createdAt: new Date().toISOString(),
    };

    this.emit("memory:compressed", {
      originalCount: entries.length,
      compressedCount: 1,
    });

    return compressed;
  }

  summarize(entries: MemoryEntry[]): string {
    if (entries.length === 0) return "";
    if (entries.length === 1) return entries[0].content;

    const allSentences: Array<{ text: string; sourceIndex: number; position: number }> = [];

    for (let i = 0; i < entries.length; i++) {
      const sentences = entries[i].content
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);

      for (let j = 0; j < sentences.length; j++) {
        allSentences.push({ text: sentences[j], sourceIndex: i, position: j });
      }
    }

    if (allSentences.length === 0) {
      return entries.map((e) => e.content).join(" ");
    }

    const scored = allSentences.map((sentence) => {
      let score = 0;

      const words = sentence.text.toLowerCase().split(/\s+/);
      const uniqueWords = new Set(words);

      score += uniqueWords.size * 0.05;

      if (sentence.text.length > 30) score += 0.3;
      if (sentence.text.length > 60) score += 0.2;

      const wordFreq = new Map<string, number>();
      for (const entry of entries) {
        const entryWords = entry.content.toLowerCase().split(/\s+/);
        for (const word of entryWords) {
          wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
        }
      }

      let tfidfSum = 0;
      for (const word of uniqueWords) {
        const tf = words.filter((w) => w === word).length / words.length;
        const idf = Math.log(entries.length / (1 + (wordFreq.get(word) ?? 0)));
        tfidfSum += tf * idf;
      }
      score += tfidfSum * 0.3;

      const entry = entries[sentence.sourceIndex];
      score += entry.importance * 0.2;

      if (sentence.position === 0) score += 0.1;

      return { ...sentence, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const targetCount = Math.max(1, Math.ceil(allSentences.length * 0.3));
    const selected = scored.slice(0, targetCount);

    selected.sort((a, b) => {
      if (a.sourceIndex !== b.sourceIndex) return a.sourceIndex - b.sourceIndex;
      return a.position - b.position;
    });

    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const s of selected) {
      const key = s.text.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(s.text);
      }
    }

    return ordered.join(". ") + ".";
  }

  extract(entries: MemoryEntry[]): KeyPoint[] {
    const keyPoints: KeyPoint[] = [];

    if (entries.length === 0) return keyPoints;

    const allSentences: Array<{ text: string; entryId: string; importance: number }> = [];
    for (const entry of entries) {
      const sentences = entry.content
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 15);
      for (const sentence of sentences) {
        allSentences.push({
          text: sentence,
          entryId: entry.id,
          importance: entry.importance,
        });
      }
    }

    const scored = allSentences.map((item) => {
      let score = item.importance;

      const indicatorWords = ["important", "key", "critical", "essential", "must", "note", "remember", "significant", "crucial", "vital"];
      const lower = item.text.toLowerCase();
      for (const indicator of indicatorWords) {
        if (lower.includes(indicator)) {
          score += 0.3;
          break;
        }
      }

      const hasNumbers = /\d+/.test(item.text);
      if (hasNumbers) score += 0.1;

      const hasComparison = /\b(more|less|better|worse|higher|lower|greater|smaller)\b/.test(lower);
      if (hasComparison) score += 0.15;

      const hasCausality = /\b(because|therefore|thus|hence|consequently|results? in|leads? to|causes?)\b/.test(lower);
      if (hasCausality) score += 0.2;

      return { ...item, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const maxKeyPoints = Math.max(1, Math.ceil(entries.length * 1.5));
    const selected = scored.slice(0, maxKeyPoints);

    const seen = new Set<string>();
    for (const item of selected) {
      const normalized = item.text.toLowerCase().trim();
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      const category = this.categorize(item.text);

      keyPoints.push({
        id: generateId(),
        text: item.text,
        importance: item.score,
        sourceIds: [item.entryId],
        category,
      });
    }

    return keyPoints;
  }

  deduplicate(entries: MemoryEntry[]): MemoryEntry[] {
    if (entries.length <= 1) return entries;

    const seen = new Map<string, MemoryEntry>();
    const result: MemoryEntry[] = [];

    for (const entry of entries) {
      const normalized = entry.content.toLowerCase().trim().replace(/\s+/g, " ");

      let isDuplicate = false;
      for (const [existingNorm, existingEntry] of seen) {
        const similarity = this.textSimilarity(normalized, existingNorm);
        if (similarity > 0.85) {
          isDuplicate = true;
          if (entry.importance > existingEntry.importance) {
            seen.set(existingNorm, entry);
          }
          break;
        }
      }

      if (!isDuplicate) {
        seen.set(normalized, entry);
      }
    }

    for (const entry of seen.values()) {
      result.push(entry);
    }

    return result;
  }

  qualityMetrics(original: MemoryEntry[], compressed: CompressedMemory): QualityMetrics {
    const originalContent = original.map((e) => e.content).join(" ");
    const compressedContent = compressed.summary + compressed.keyPoints.map((kp) => kp.text).join(" ");

    const informationRetention = this.computeInformationRetention(original, compressed);

    const originalLength = originalContent.length;
    const compressedLength = compressedContent.length;
    const compressionRatio = originalLength > 0 ? compressedLength / originalLength : 1;

    const originalWords = new Set(originalContent.toLowerCase().split(/\s+/));
    const compressedWords = new Set(compressedContent.toLowerCase().split(/\s+/));
    const wordOverlap = originalWords.size > 0
      ? Array.from(compressedWords).filter((w) => originalWords.has(w)).length / originalWords.size
      : 0;

    const keyPointCoverage = original.length > 0
      ? compressed.keyPoints.length / original.length
      : 0;

    const fidelityScore =
      informationRetention * 0.35 +
      wordOverlap * 0.25 +
      Math.min(keyPointCoverage, 1) * 0.2 +
      (1 - compressionRatio) * 0.2;

    return {
      informationRetention,
      compressionRatio,
      semanticSimilarity: wordOverlap,
      keyPointCoverage: Math.min(keyPointCoverage, 1),
      fidelityScore: Math.max(0, Math.min(1, fidelityScore)),
    };
  }

  private computeInformationRetention(original: MemoryEntry[], compressed: CompressedMemory): number {
    if (original.length === 0) return 1;

    const originalKeyTerms = new Set<string>();
    for (const entry of original) {
      const words = entry.content.toLowerCase().split(/\s+/)
        .filter((w) => w.length > 3);
      for (const word of words) {
        originalKeyTerms.add(word);
      }
    }

    const compressedText = (compressed.summary + " " + compressed.keyPoints.map((kp) => kp.text).join(" ")).toLowerCase();
    const compressedWords = new Set(compressedText.split(/\s+/));

    let retained = 0;
    for (const term of originalKeyTerms) {
      if (compressedWords.has(term)) {
        retained += 1;
      }
    }

    return originalKeyTerms.size > 0 ? retained / originalKeyTerms.size : 1;
  }

  private categorize(text: string): string {
    const lower = text.toLowerCase();

    if (/\b(define|definition|is a|refers to|means)\b/.test(lower)) return "definition";
    if (/\b(because|therefore|thus|hence|causes?|leads? to|results? in)\b/.test(lower)) return "causal";
    if (/\b(step|first|then|next|finally|process|procedure|method)\b/.test(lower)) return "procedural";
    if (/\b(important|critical|essential|must|should|key|vital)\b/.test(lower)) return "critical";
    if (/\b(compare|versus|difference|similar|contrast|better|worse)\b/.test(lower)) return "comparative";
    if (/\b(example|instance|such as|like|including)\b/.test(lower)) return "example";

    return "factual";
  }

  private textSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.split(/\s+/));
    const wordsB = new Set(b.split(/\s+/));
    const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
    const union = new Set([...wordsA, ...wordsB]);
    return union.size > 0 ? intersection.size / union.size : 0;
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
