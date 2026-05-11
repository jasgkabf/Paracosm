import type { MemoryEntry } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('MemoryIndexer');

export class MemoryIndexer {
  private invertedIndex: Map<string, Set<string>> = new Map();
  private bigramIndex: Map<string, Set<string>> = new Map();

  index(entry: MemoryEntry): void {
    const tokens = this.tokenize(entry.content);
    for (const token of tokens) {
      const set = this.invertedIndex.get(token) ?? new Set();
      set.add(entry.id);
      this.invertedIndex.set(token, set);
    }
    for (let i = 0; i < tokens.length - 1; i++) {
      const bigram = `${tokens[i]}_${tokens[i + 1]}`;
      const set = this.bigramIndex.get(bigram) ?? new Set();
      set.add(entry.id);
      this.bigramIndex.set(bigram, set);
    }
  }

  deindex(entryId: string, content?: string): void {
    if (content) {
      const tokens = this.tokenize(content);
      for (const token of tokens) {
        const set = this.invertedIndex.get(token);
        if (set) {
          set.delete(entryId);
          if (set.size === 0) this.invertedIndex.delete(token);
        }
      }
    } else {
      for (const [token, ids] of this.invertedIndex) {
        ids.delete(entryId);
        if (ids.size === 0) this.invertedIndex.delete(token);
      }
      for (const [bigram, ids] of this.bigramIndex) {
        ids.delete(entryId);
        if (ids.size === 0) this.bigramIndex.delete(bigram);
      }
    }
  }

  search(query: string): string[] {
    const tokens = this.tokenize(query);
    if (tokens.length === 0) return [];
    let result = this.invertedIndex.get(tokens[0]) ?? new Set();
    for (let i = 1; i < tokens.length; i++) {
      const tokenSet = this.invertedIndex.get(tokens[i]) ?? new Set();
      result = new Set([...result].filter((id) => tokenSet.has(id)));
    }
    return Array.from(result);
  }

  fuzzySearch(query: string): string[] {
    const tokens = this.tokenize(query);
    const scores = new Map<string, number>();
    for (const token of tokens) {
      for (const [indexToken, ids] of this.invertedIndex) {
        if (indexToken.includes(token) || token.includes(indexToken)) {
          for (const id of ids) {
            scores.set(id, (scores.get(id) ?? 0) + 1);
          }
        }
      }
    }
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase().split(/[\s,.!?;:()[\]{}'"\/\\]+/).filter((t) => t.length > 1);
  }

  clear(): void {
    this.invertedIndex.clear();
    this.bigramIndex.clear();
  }
}
