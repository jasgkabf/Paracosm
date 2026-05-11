import type { MemoryEntry, MemoryType } from "@paracosm/shared";
import { generateId } from "@paracosm/shared";
import type { MemoryEvents, MemoryEventName } from "./types.js";

type EventHandler = (data: unknown) => void;

export class ShortTermMemory {
  private entries: Map<string, MemoryEntry>;
  private maxEntries: number;
  private defaultTtlMs: number;
  private compressionThreshold: number;
  private listeners: Map<string, Set<EventHandler>>;

  constructor(maxEntries: number = 1000, defaultTtlMs: number = 3600000) {
    this.entries = new Map();
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
    this.compressionThreshold = 0.6;
    this.listeners = new Map();
  }

  add(entry: Partial<MemoryEntry> & { content: string }): void {
    const now = new Date().toISOString();
    const id = entry.id ?? generateId();
    const expiresAt = entry.expiresAt ?? new Date(Date.now() + this.defaultTtlMs).toISOString();

    const memoryEntry: MemoryEntry = {
      id,
      type: entry.type ?? ("conversation" as MemoryType),
      content: entry.content,
      embedding: entry.embedding ?? null,
      importance: entry.importance ?? 0.5,
      accessCount: 0,
      lastAccessedAt: now,
      expiresAt,
      tags: entry.tags ?? [],
      source: entry.source ?? "unknown",
      metadata: entry.metadata ?? {},
      createdAt: entry.createdAt ?? now,
      updatedAt: entry.updatedAt ?? now,
    };

    if (this.entries.size >= this.maxEntries) {
      this.expire();
      if (this.entries.size >= this.maxEntries) {
        this.compress();
      }
    }

    this.entries.set(id, memoryEntry);
    this.emit("memory:stored", { entryId: id, tier: memoryEntry.type });
  }

  query(query: {
    text?: string;
    tags?: string[];
    type?: MemoryType;
    minImportance?: number;
    limit?: number;
  }): MemoryEntry[] {
    let results = Array.from(this.entries.values());

    if (query.type) {
      results = results.filter((e) => e.type === query.type);
    }

    if (query.minImportance !== undefined) {
      results = results.filter((e) => e.importance >= query.minImportance!);
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter((e) =>
        query.tags!.some((tag) => e.tags.includes(tag))
      );
    }

    if (query.text) {
      const lowerQuery = query.text.toLowerCase();
      const terms = lowerQuery.split(/\s+/).filter((t) => t.length > 0);
      results = results.filter((e) => {
        const content = e.content.toLowerCase();
        return terms.some((term) => content.includes(term));
      });
    }

    results.sort((a, b) => {
      const recencyA = this.recencyWeight(a);
      const recencyB = this.recencyWeight(b);
      const scoreA = a.importance * 0.4 + recencyA * 0.6;
      const scoreB = b.importance * 0.4 + recencyB * 0.6;
      return scoreB - scoreA;
    });

    if (query.limit !== undefined) {
      results = results.slice(0, query.limit);
    }

    for (const entry of results) {
      entry.accessCount += 1;
      entry.lastAccessedAt = new Date().toISOString();
    }

    return results;
  }

  expire(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [id, entry] of this.entries) {
      if (entry.expiresAt) {
        const expiryTime = new Date(entry.expiresAt).getTime();
        if (now >= expiryTime) {
          expired.push(id);
        }
      }
    }

    for (const id of expired) {
      this.entries.delete(id);
      this.emit("memory:expired", { entryId: id, tier: "conversation" as MemoryType });
    }
  }

  compress(): void {
    const now = Date.now();
    const thresholdMs = this.defaultTtlMs * this.compressionThreshold;
    const oldEntries: MemoryEntry[] = [];
    const toRemove: string[] = [];

    for (const [id, entry] of this.entries) {
      const age = now - new Date(entry.createdAt).getTime();
      if (age > thresholdMs && entry.importance < 0.7) {
        oldEntries.push(entry);
        toRemove.push(id);
      }
    }

    if (oldEntries.length < 2) {
      return;
    }

    const summary = this.summarize(oldEntries);
    const compressedEntry: MemoryEntry = {
      id: generateId(),
      type: oldEntries[0].type,
      content: summary,
      embedding: null,
      importance: Math.max(...oldEntries.map((e) => e.importance)) * 0.8,
      accessCount: 0,
      lastAccessedAt: new Date().toISOString(),
      expiresAt: new Date(now + this.defaultTtlMs).toISOString(),
      tags: [...new Set(oldEntries.flatMap((e) => e.tags))],
      source: "compression",
      metadata: {
        compressedFrom: oldEntries.map((e) => e.id),
        compressionRatio: oldEntries.length / 1,
        originalCount: oldEntries.length,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    for (const id of toRemove) {
      this.entries.delete(id);
    }

    this.entries.set(compressedEntry.id, compressedEntry);
    this.emit("memory:compressed", {
      originalCount: oldEntries.length,
      compressedCount: 1,
    });
  }

  summarize(entries: MemoryEntry[]): string {
    if (entries.length === 0) {
      return "";
    }

    if (entries.length === 1) {
      return entries[0].content;
    }

    const allContent = entries.map((e) => e.content);
    const sentences: string[] = [];

    for (const content of allContent) {
      const parts = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      sentences.push(...parts.map((s) => s.trim()));
    }

    const scored = sentences.map((sentence) => {
      let score = 0;
      const words = sentence.toLowerCase().split(/\s+/);
      const uniqueWords = new Set(words);
      score += uniqueWords.size * 0.1;
      score += sentence.length > 20 ? 0.5 : 0;
      score += sentence.length > 50 ? 0.3 : 0;

      for (const entry of entries) {
        const entryWords = new Set(entry.content.toLowerCase().split(/\s+/));
        let overlap = 0;
        for (const word of uniqueWords) {
          if (entryWords.has(word)) {
            overlap += 1;
          }
        }
        score += overlap / Math.max(uniqueWords.size, 1);
      }

      return { sentence, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const targetCount = Math.max(1, Math.ceil(sentences.length * 0.3));
    const selected = scored.slice(0, targetCount).map((s) => s.sentence);

    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const s of selected) {
      const key = s.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(s);
      }
    }

    return ordered.join(". ") + ".";
  }

  slidingWindow(size: number): MemoryEntry[] {
    const entries = Array.from(this.entries.values());
    entries.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA;
    });
    return entries.slice(0, size);
  }

  recencyWeight(entry: MemoryEntry): number {
    const now = Date.now();
    const lastAccessed = new Date(entry.lastAccessedAt).getTime();
    const ageMs = now - lastAccessed;
    const halfLifeMs = this.defaultTtlMs / 2;
    const weight = Math.exp(-0.693 * (ageMs / halfLifeMs));
    return Math.max(0, Math.min(1, weight));
  }

  get(id: string): MemoryEntry | undefined {
    const entry = this.entries.get(id);
    if (entry) {
      entry.accessCount += 1;
      entry.lastAccessedAt = new Date().toISOString();
    }
    return entry;
  }

  delete(id: string): boolean {
    const deleted = this.entries.delete(id);
    if (deleted) {
      this.emit("memory:deleted", { entryId: id, tier: "conversation" as MemoryType });
    }
    return deleted;
  }

  clear(): void {
    this.entries.clear();
  }

  size(): number {
    return this.entries.size;
  }

  all(): MemoryEntry[] {
    return Array.from(this.entries.values());
  }

  setTtl(ttlMs: number): void {
    this.defaultTtlMs = ttlMs;
  }

  setMaxEntries(max: number): void {
    this.maxEntries = max;
    while (this.entries.size > this.maxEntries) {
      this.expire();
      if (this.entries.size > this.maxEntries) {
        const oldest = this.findOldest();
        if (oldest) {
          this.entries.delete(oldest.id);
          this.emit("memory:evicted", { entryId: oldest.id, reason: "capacity" });
        } else {
          break;
        }
      }
    }
  }

  private findOldest(): MemoryEntry | null {
    let oldest: MemoryEntry | null = null;
    let oldestTime = Infinity;
    for (const entry of this.entries.values()) {
      const time = new Date(entry.lastAccessedAt).getTime();
      if (time < oldestTime) {
        oldestTime = time;
        oldest = entry;
      }
    }
    return oldest;
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
