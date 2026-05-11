import type { MemoryEntry, MemoryType } from "@paracosm/shared";
import type { FacetResult, MemoryEvents, MemoryEventName } from "./types.js";
import { cosineSimilarity, normalize } from "./vector-store/vector-utils.js";

type EventHandler = (data: unknown) => void;

interface IndexEntry {
  id: string;
  entry: MemoryEntry;
  tokens: string[];
  embedding: number[];
}

export class MemoryIndexer {
  private invertedIndex: Map<string, Set<string>>;
  private vectorIndex: Map<string, number[]>;
  private facetIndex: Map<string, Map<string, Set<string>>>;
  private entries: Map<string, IndexEntry>;
  private listeners: Map<string, Set<EventHandler>>;
  private embeddingDimension: number;

  constructor(embeddingDimension: number = 128) {
    this.invertedIndex = new Map();
    this.vectorIndex = new Map();
    this.facetIndex = new Map();
    this.entries = new Map();
    this.listeners = new Map();
    this.embeddingDimension = embeddingDimension;
  }

  index(entry: MemoryEntry): void {
    const tokens = this.tokenize(entry.content);
    const embedding = entry.embedding ?? this.generateEmbedding(tokens);

    const indexEntry: IndexEntry = {
      id: entry.id,
      entry,
      tokens,
      embedding,
    };

    this.entries.set(entry.id, indexEntry);

    for (const token of tokens) {
      if (!this.invertedIndex.has(token)) {
        this.invertedIndex.set(token, new Set());
      }
      this.invertedIndex.get(token)!.add(entry.id);
    }

    this.vectorIndex.set(entry.id, embedding);

    this.indexFacet("type", entry.type, entry.id);
    this.indexFacet("source", entry.source, entry.id);
    for (const tag of entry.tags) {
      this.indexFacet("tag", tag, entry.id);
    }
    this.indexFacet("importance", this.importanceBucket(entry.importance), entry.id);

    this.emit("memory:indexed", { entryId: entry.id });
  }

  reindex(): void {
    const allEntries = Array.from(this.entries.values());

    this.invertedIndex.clear();
    this.vectorIndex.clear();
    this.facetIndex.clear();

    for (const indexEntry of allEntries) {
      const tokens = this.tokenize(indexEntry.entry.content);
      indexEntry.tokens = tokens;

      for (const token of tokens) {
        if (!this.invertedIndex.has(token)) {
          this.invertedIndex.set(token, new Set());
        }
        this.invertedIndex.get(token)!.add(indexEntry.id);
      }

      this.vectorIndex.set(indexEntry.id, indexEntry.embedding);

      this.indexFacet("type", indexEntry.entry.type, indexEntry.id);
      this.indexFacet("source", indexEntry.entry.source, indexEntry.id);
      for (const tag of indexEntry.entry.tags) {
        this.indexFacet("tag", tag, indexEntry.id);
      }
      this.indexFacet("importance", this.importanceBucket(indexEntry.entry.importance), indexEntry.id);
    }
  }

  search(query: {
    text?: string;
    embedding?: number[];
    types?: MemoryType[];
    tags?: string[];
    minImportance?: number;
    limit?: number;
  }): MemoryEntry[] {
    let candidateIds: Set<string> | null = null;

    if (query.text) {
      const tokens = this.tokenize(query.text);
      const matchedIds: Set<string>[] = [];

      for (const token of tokens) {
        const ids = this.invertedIndex.get(token);
        if (ids) {
          matchedIds.push(new Set(ids));
        }
      }

      if (matchedIds.length > 0) {
        candidateIds = matchedIds.reduce((acc, set) => {
          const result = new Set<string>();
          for (const id of acc) {
            if (set.has(id)) {
              result.add(id);
            }
          }
          return result;
        });
      } else {
        candidateIds = new Set();
      }
    }

    if (query.types && query.types.length > 0) {
      const typeIds = new Set<string>();
      for (const type of query.types) {
        const ids = this.facetIndex.get("type")?.get(type);
        if (ids) {
          for (const id of ids) {
            typeIds.add(id);
          }
        }
      }

      if (candidateIds) {
        const intersection = new Set<string>();
        for (const id of candidateIds) {
          if (typeIds.has(id)) {
            intersection.add(id);
          }
        }
        candidateIds = intersection;
      } else {
        candidateIds = typeIds;
      }
    }

    if (query.tags && query.tags.length > 0) {
      const tagIds = new Set<string>();
      for (const tag of query.tags) {
        const ids = this.facetIndex.get("tag")?.get(tag);
        if (ids) {
          for (const id of ids) {
            tagIds.add(id);
          }
        }
      }

      if (candidateIds) {
        const intersection = new Set<string>();
        for (const id of candidateIds) {
          if (tagIds.has(id)) {
            intersection.add(id);
          }
        }
        candidateIds = intersection;
      } else {
        candidateIds = tagIds;
      }
    }

    if (candidateIds === null) {
      candidateIds = new Set(this.entries.keys());
    }

    let results: Array<{ entry: MemoryEntry; score: number }> = [];

    for (const id of candidateIds) {
      const indexEntry = this.entries.get(id);
      if (!indexEntry) continue;

      if (query.minImportance !== undefined && indexEntry.entry.importance < query.minImportance) {
        continue;
      }

      let score = 0;

      if (query.text) {
        const queryTokens = this.tokenize(query.text);
        const overlap = queryTokens.filter((t) => indexEntry.tokens.includes(t));
        score += (overlap.length / Math.max(queryTokens.length, 1)) * 0.5;
      }

      if (query.embedding) {
        const similarity = cosineSimilarity(query.embedding, indexEntry.embedding);
        score += similarity * 0.5;
      }

      if (!query.text && !query.embedding) {
        score = indexEntry.entry.importance;
      }

      results.push({ entry: indexEntry.entry, score });
    }

    results.sort((a, b) => b.score - a.score);

    if (query.limit !== undefined) {
      results = results.slice(0, query.limit);
    }

    return results.map((r) => r.entry);
  }

  suggest(prefix: string): string[] {
    const normalized = prefix.toLowerCase();
    const suggestions: Array<{ term: string; count: number }> = [];

    for (const [term, ids] of this.invertedIndex) {
      if (term.startsWith(normalized)) {
        suggestions.push({ term, count: ids.size });
      }
    }

    suggestions.sort((a, b) => b.count - a.count);
    return suggestions.slice(0, 10).map((s) => s.term);
  }

  facets(query?: { types?: MemoryType[]; tags?: string[] }): FacetResult {
    const result: FacetResult = {
      facets: {},
      totalMatches: this.entries.size,
    };

    for (const [facetName, facetValues] of this.facetIndex) {
      result.facets[facetName] = {};
      for (const [value, ids] of facetValues) {
        result.facets[facetName][value] = ids.size;
      }
    }

    if (query) {
      result.totalMatches = 0;
      const candidateIds = new Set<string>();

      if (query.types) {
        for (const type of query.types) {
          const ids = this.facetIndex.get("type")?.get(type);
          if (ids) {
            for (const id of ids) {
              candidateIds.add(id);
            }
          }
        }
      }

      if (query.tags) {
        const tagIds = new Set<string>();
        for (const tag of query.tags) {
          const ids = this.facetIndex.get("tag")?.get(tag);
          if (ids) {
            for (const id of ids) {
              tagIds.add(id);
            }
          }
        }
        if (candidateIds.size > 0) {
          const intersection = new Set<string>();
          for (const id of candidateIds) {
            if (tagIds.has(id)) {
              intersection.add(id);
            }
          }
          candidateIds.clear();
          for (const id of intersection) {
            candidateIds.add(id);
          }
        } else {
          for (const id of tagIds) {
            candidateIds.add(id);
          }
        }
      }

      result.totalMatches = candidateIds.size;
    }

    return result;
  }

  remove(entryId: string): void {
    const indexEntry = this.entries.get(entryId);
    if (!indexEntry) return;

    for (const token of indexEntry.tokens) {
      const ids = this.invertedIndex.get(token);
      if (ids) {
        ids.delete(entryId);
        if (ids.size === 0) {
          this.invertedIndex.delete(token);
        }
      }
    }

    this.vectorIndex.delete(entryId);

    for (const [, facetValues] of this.facetIndex) {
      for (const [, ids] of facetValues) {
        ids.delete(entryId);
      }
    }

    this.entries.delete(entryId);
  }

  clear(): void {
    this.invertedIndex.clear();
    this.vectorIndex.clear();
    this.facetIndex.clear();
    this.entries.clear();
  }

  size(): number {
    return this.entries.size;
  }

  getIndexedEntry(id: string): IndexEntry | undefined {
    return this.entries.get(id);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[\s\p{P}]+/u)
      .filter((t) => t.length > 1)
      .map((t) => t.replace(/[^a-z0-9]/g, ""))
      .filter((t) => t.length > 1);
  }

  private generateEmbedding(tokens: string[]): number[] {
    const vector: number[] = [];
    for (let i = 0; i < this.embeddingDimension; i++) {
      let val = 0;
      for (let j = 0; j < tokens.length; j++) {
        const charCode = tokens[j].charCodeAt(j % tokens[j].length);
        val += Math.sin(charCode * (i + 1) * 0.001) * 0.5;
      }
      val /= Math.max(tokens.length, 1);
      vector.push(val);
    }
    return normalize(vector);
  }

  private indexFacet(facetName: string, value: string, entryId: string): void {
    if (!this.facetIndex.has(facetName)) {
      this.facetIndex.set(facetName, new Map());
    }
    if (!this.facetIndex.get(facetName)!.has(value)) {
      this.facetIndex.get(facetName)!.set(value, new Set());
    }
    this.facetIndex.get(facetName)!.get(value)!.add(entryId);
  }

  private importanceBucket(importance: number): string {
    if (importance >= 0.8) return "critical";
    if (importance >= 0.6) return "high";
    if (importance >= 0.4) return "medium";
    if (importance >= 0.2) return "low";
    return "minimal";
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
