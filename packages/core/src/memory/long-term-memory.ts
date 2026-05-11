import type { MemoryEntry, MemoryType, MemorySearchResult } from "@paracosm/shared";
import { generateId } from "@paracosm/shared";
import type { MemoryEvents, MemoryEventName } from "./types.js";

type EventHandler = (data: unknown) => void;

interface Association {
  targetId: string;
  strength: number;
  createdAt: string;
  lastReinforcedAt: string;
}

export class LongTermMemory {
  private entries: Map<string, MemoryEntry>;
  private associations: Map<string, Association[]>;
  private invertedIndex: Map<string, Set<string>>;
  private tagIndex: Map<string, Set<string>>;
  private typeIndex: Map<MemoryType, Set<string>>;
  private decayRate: number;
  private maxEntries: number;
  private listeners: Map<string, Set<EventHandler>>;

  constructor(maxEntries: number = 100000, decayRate: number = 0.01) {
    this.entries = new Map();
    this.associations = new Map();
    this.invertedIndex = new Map();
    this.tagIndex = new Map();
    this.typeIndex = new Map();
    this.decayRate = decayRate;
    this.maxEntries = maxEntries;
    this.listeners = new Map();
  }

  store(entry: Partial<MemoryEntry> & { content: string }): void {
    const now = new Date().toISOString();
    const id = entry.id ?? generateId();

    const memoryEntry: MemoryEntry = {
      id,
      type: entry.type ?? ("long_term" as MemoryType),
      content: entry.content,
      embedding: entry.embedding ?? null,
      importance: entry.importance ?? 0.5,
      accessCount: 0,
      lastAccessedAt: now,
      expiresAt: null,
      tags: entry.tags ?? [],
      source: entry.source ?? "unknown",
      metadata: entry.metadata ?? {},
      createdAt: entry.createdAt ?? now,
      updatedAt: entry.updatedAt ?? now,
    };

    this.entries.set(id, memoryEntry);
    this.index(memoryEntry);
    this.emit("memory:stored", { entryId: id, tier: memoryEntry.type });
  }

  retrieve(id: string): MemoryEntry | null {
    const entry = this.entries.get(id);
    if (!entry) {
      return null;
    }

    entry.accessCount += 1;
    entry.lastAccessedAt = new Date().toISOString();
    this.emit("memory:retrieved", { entryId: id, tier: entry.type });
    return entry;
  }

  index(entry: MemoryEntry): void {
    const words = entry.content.toLowerCase().split(/\s+/);
    for (const word of words) {
      const normalized = word.replace(/[^a-z0-9]/g, "");
      if (normalized.length < 2) continue;
      if (!this.invertedIndex.has(normalized)) {
        this.invertedIndex.set(normalized, new Set());
      }
      this.invertedIndex.get(normalized)!.add(entry.id);
    }

    for (const tag of entry.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(entry.id);
    }

    if (!this.typeIndex.has(entry.type)) {
      this.typeIndex.set(entry.type, new Set());
    }
    this.typeIndex.get(entry.type)!.add(entry.id);

    this.emit("memory:indexed", { entryId: entry.id });
  }

  search(query: {
    text?: string;
    tags?: string[];
    type?: MemoryType;
    minImportance?: number;
    limit?: number;
  }): MemorySearchResult[] {
    let candidateIds: Set<string> | null = null;

    if (query.text) {
      const terms = query.text.toLowerCase().split(/\s+/);
      const termResults: Set<string>[] = [];

      for (const term of terms) {
        const normalized = term.replace(/[^a-z0-9]/g, "");
        const matchingIds = this.invertedIndex.get(normalized);
        if (matchingIds) {
          termResults.push(new Set(matchingIds));
        }
      }

      if (termResults.length > 0) {
        candidateIds = termResults.reduce((acc, set) => {
          const intersection = new Set<string>();
          for (const id of acc) {
            if (set.has(id)) {
              intersection.add(id);
            }
          }
          return intersection;
        });
      } else {
        candidateIds = new Set();
      }
    }

    if (query.tags && query.tags.length > 0) {
      const tagResults: Set<string>[] = [];
      for (const tag of query.tags) {
        const matchingIds = this.tagIndex.get(tag);
        if (matchingIds) {
          tagResults.push(new Set(matchingIds));
        }
      }

      if (tagResults.length > 0) {
        const tagUnion = tagResults.reduce((acc, set) => {
          for (const id of set) {
            acc.add(id);
          }
          return acc;
        }, new Set<string>());

        if (candidateIds) {
          const intersection = new Set<string>();
          for (const id of candidateIds) {
            if (tagUnion.has(id)) {
              intersection.add(id);
            }
          }
          candidateIds = intersection;
        } else {
          candidateIds = tagUnion;
        }
      }
    }

    if (query.type) {
      const typeIds = this.typeIndex.get(query.type);
      if (typeIds) {
        if (candidateIds) {
          const intersection = new Set<string>();
          for (const id of candidateIds) {
            if (typeIds.has(id)) {
              intersection.add(id);
            }
          }
          candidateIds = intersection;
        } else {
          candidateIds = new Set(typeIds);
        }
      }
    }

    if (candidateIds === null) {
      candidateIds = new Set(this.entries.keys());
    }

    let results: MemorySearchResult[] = [];

    for (const id of candidateIds) {
      const entry = this.entries.get(id);
      if (!entry) continue;

      if (query.minImportance !== undefined && entry.importance < query.minImportance) {
        continue;
      }

      const score = this.computeSearchScore(entry, query);
      const highlights = this.extractHighlights(entry, query);

      results.push({
        entry,
        score,
        highlights,
        matchReason: this.describeMatchReason(entry, query),
      });
    }

    results.sort((a, b) => b.score - a.score);

    if (query.limit !== undefined) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  consolidate(): void {
    const now = Date.now();
    const toPromote: string[] = [];
    const toDemote: string[] = [];

    for (const [id, entry] of this.entries) {
      const accessRate = entry.accessCount / Math.max(1, (now - new Date(entry.createdAt).getTime()) / 86400000);

      if (accessRate > 5 && entry.importance > 0.7) {
        toPromote.push(id);
      } else if (accessRate < 0.1 && entry.importance < 0.3) {
        toDemote.push(id);
      }
    }

    for (const id of toPromote) {
      const entry = this.entries.get(id);
      if (entry) {
        entry.importance = Math.min(1, entry.importance + 0.1);
        this.emit("memory:consolidated", {
          entryId: id,
          from: entry.type,
          to: "long_term" as MemoryType,
        });
      }
    }

    for (const id of toDemote) {
      const entry = this.entries.get(id);
      if (entry) {
        entry.importance = Math.max(0, entry.importance - 0.1);
        this.emit("memory:consolidated", {
          entryId: id,
          from: entry.type,
          to: "long_term" as MemoryType,
        });
      }
    }
  }

  decay(): void {
    const now = Date.now();

    for (const [id, entry] of this.entries) {
      const ageMs = now - new Date(entry.lastAccessedAt).getTime();
      const ageDays = ageMs / 86400000;
      const decayFactor = Math.exp(-this.decayRate * ageDays);
      const newImportance = entry.importance * decayFactor;

      const oldImportance = entry.importance;
      entry.importance = Math.max(0.01, newImportance);

      if (Math.abs(oldImportance - entry.importance) > 0.001) {
        this.emit("memory:decayed", { entryId: id, newImportance: entry.importance });
      }
    }
  }

  reinforce(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;

    const boost = 0.1;
    const oldImportance = entry.importance;
    entry.importance = Math.min(1, entry.importance + boost);
    entry.accessCount += 1;
    entry.lastAccessedAt = new Date().toISOString();

    this.emit("memory:reinforced", { entryId: id, newImportance: entry.importance });

    const assocList = this.associations.get(id);
    if (assocList) {
      for (const assoc of assocList) {
        const relatedEntry = this.entries.get(assoc.targetId);
        if (relatedEntry) {
          const indirectBoost = boost * assoc.strength * 0.3;
          relatedEntry.importance = Math.min(1, relatedEntry.importance + indirectBoost);
        }
      }
    }
  }

  associate(id1: string, id2: string, strength: number): void {
    if (!this.entries.has(id1) || !this.entries.has(id2)) {
      return;
    }

    const now = new Date().toISOString();
    const clampedStrength = Math.max(0, Math.min(1, strength));

    if (!this.associations.has(id1)) {
      this.associations.set(id1, []);
    }
    const existing1 = this.associations.get(id1)!.find((a) => a.targetId === id2);
    if (existing1) {
      existing1.strength = clampedStrength;
      existing1.lastReinforcedAt = now;
    } else {
      this.associations.get(id1)!.push({
        targetId: id2,
        strength: clampedStrength,
        createdAt: now,
        lastReinforcedAt: now,
      });
    }

    if (!this.associations.has(id2)) {
      this.associations.set(id2, []);
    }
    const existing2 = this.associations.get(id2)!.find((a) => a.targetId === id1);
    if (existing2) {
      existing2.strength = clampedStrength;
      existing2.lastReinforcedAt = now;
    } else {
      this.associations.get(id2)!.push({
        targetId: id1,
        strength: clampedStrength,
        createdAt: now,
        lastReinforcedAt: now,
      });
    }

    this.emit("memory:associated", { sourceId: id1, targetId: id2, strength: clampedStrength });
  }

  getAssociations(id: string): Association[] {
    return this.associations.get(id) ?? [];
  }

  delete(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;

    this.removeFromIndex(entry);
    this.entries.delete(id);
    this.associations.delete(id);

    for (const [, assocList] of this.associations) {
      const filtered = assocList.filter((a) => a.targetId !== id);
      this.associations.set(id, filtered);
    }

    this.emit("memory:deleted", { entryId: id, tier: entry.type });
    return true;
  }

  size(): number {
    return this.entries.size;
  }

  all(): MemoryEntry[] {
    return Array.from(this.entries.values());
  }

  clear(): void {
    this.entries.clear();
    this.associations.clear();
    this.invertedIndex.clear();
    this.tagIndex.clear();
    this.typeIndex.clear();
  }

  setDecayRate(rate: number): void {
    this.decayRate = rate;
  }

  private removeFromIndex(entry: MemoryEntry): void {
    const words = entry.content.toLowerCase().split(/\s+/);
    for (const word of words) {
      const normalized = word.replace(/[^a-z0-9]/g, "");
      if (normalized.length < 2) continue;
      const set = this.invertedIndex.get(normalized);
      if (set) {
        set.delete(entry.id);
        if (set.size === 0) {
          this.invertedIndex.delete(normalized);
        }
      }
    }

    for (const tag of entry.tags) {
      const set = this.tagIndex.get(tag);
      if (set) {
        set.delete(entry.id);
        if (set.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    const typeSet = this.typeIndex.get(entry.type);
    if (typeSet) {
      typeSet.delete(entry.id);
      if (typeSet.size === 0) {
        this.typeIndex.delete(entry.type);
      }
    }
  }

  private computeSearchScore(
    entry: MemoryEntry,
    query: { text?: string; tags?: string[]; minImportance?: number }
  ): number {
    let score = 0;

    score += entry.importance * 0.3;

    if (query.text) {
      const terms = query.text.toLowerCase().split(/\s+/);
      const content = entry.content.toLowerCase();
      let matchCount = 0;
      for (const term of terms) {
        if (content.includes(term)) {
          matchCount += 1;
        }
      }
      score += (matchCount / terms.length) * 0.4;
    }

    if (query.tags && query.tags.length > 0) {
      const tagOverlap = query.tags.filter((t) => entry.tags.includes(t)).length;
      score += (tagOverlap / query.tags.length) * 0.2;
    }

    const now = Date.now();
    const ageMs = now - new Date(entry.lastAccessedAt).getTime();
    const recencyScore = Math.exp(-ageMs / 86400000);
    score += recencyScore * 0.1;

    return Math.min(1, score);
  }

  private extractHighlights(
    entry: MemoryEntry,
    query: { text?: string }
  ): string[] {
    if (!query.text) return [];

    const highlights: string[] = [];
    const terms = query.text.toLowerCase().split(/\s+/);
    const sentences = entry.content.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (terms.some((term) => lower.includes(term))) {
        highlights.push(sentence.trim());
      }
    }

    return highlights.slice(0, 3);
  }

  private describeMatchReason(
    entry: MemoryEntry,
    query: { text?: string; tags?: string[]; type?: MemoryType }
  ): string {
    const reasons: string[] = [];

    if (query.text) {
      const terms = query.text.toLowerCase().split(/\s+/);
      const content = entry.content.toLowerCase();
      const matched = terms.filter((t) => content.includes(t));
      if (matched.length > 0) {
        reasons.push(`text match: ${matched.join(", ")}`);
      }
    }

    if (query.tags) {
      const matched = query.tags.filter((t) => entry.tags.includes(t));
      if (matched.length > 0) {
        reasons.push(`tag match: ${matched.join(", ")}`);
      }
    }

    if (query.type && entry.type === query.type) {
      reasons.push(`type match: ${query.type}`);
    }

    if (entry.importance > 0.7) {
      reasons.push("high importance");
    }

    return reasons.length > 0 ? reasons.join("; ") : "no specific match reason";
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
