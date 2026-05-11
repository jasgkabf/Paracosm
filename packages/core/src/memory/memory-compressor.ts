import type { MemoryEntry } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('MemoryCompressor');

export class MemoryCompressor {
  compress(entries: MemoryEntry[]): MemoryEntry {
    if (entries.length === 0) {
      return this.createEmptyEntry();
    }
    const combinedContent = entries.map((e) => e.content).join('\n');
    const compressedContent = this.summarize(combinedContent);
    const maxImportance = Math.max(...entries.map((e) => e.importance ?? 0));
    const totalAccessCount = entries.reduce((sum, e) => sum + e.accessCount, 0);
    const earliestDate = new Date(Math.min(...entries.map((e) => e.createdAt.getTime())));
    return {
      id: entries[0].id,
      content: compressedContent,
      type: entries[0].type,
      importance: maxImportance,
      metadata: {
        compressedFrom: entries.map((e) => e.id),
        originalCount: entries.length,
        compressionRatio: compressedContent.length / combinedContent.length,
      },
      createdAt: earliestDate,
      accessCount: totalAccessCount,
      lastAccessedAt: new Date(),
    };
  }

  private summarize(text: string): string {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    if (sentences.length <= 3) return text;
    const scored = sentences.map((sentence) => {
      let score = 0;
      const words = sentence.toLowerCase().split(/\s+/);
      score += words.length > 5 ? 1 : 0;
      score += sentence.includes('important') || sentence.includes('key') || sentence.includes('critical') ? 2 : 0;
      score += sentence.includes('result') || sentence.includes('outcome') || sentence.includes('conclusion') ? 1 : 0;
      return { sentence: sentence.trim(), score };
    });
    scored.sort((a, b) => b.score - a.score);
    const topSentences = scored.slice(0, Math.min(3, scored.length));
    return topSentences.map((s) => s.sentence).join('. ') + '.';
  }

  private createEmptyEntry(): MemoryEntry {
    return {
      id: '',
      content: '',
      type: 'semantic',
      importance: 0,
      metadata: {},
      createdAt: new Date(),
      accessCount: 0,
      lastAccessedAt: new Date(),
    };
  }

  estimateCompressionRatio(entries: MemoryEntry[]): number {
    if (entries.length <= 1) return 1;
    const totalLength = entries.reduce((sum, e) => sum + e.content.length, 0);
    const estimatedCompressedLength = totalLength * 0.3;
    return estimatedCompressedLength / totalLength;
  }
}
