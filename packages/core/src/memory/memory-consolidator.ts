import type { MemoryEntry, MemoryType } from "@paracosm/shared";
import type { ConsolidationRule, MemoryEvents, MemoryEventName } from "./types.js";
import { MemoryCompressor } from "./memory-compressor.js";

type EventHandler = (data: unknown) => void;

interface ConsolidationCandidate {
  entryId: string;
  entry: MemoryEntry;
  currentTier: MemoryType;
  targetTier: MemoryType;
  action: "promote" | "demote" | "archive" | "merge" | "delete";
  score: number;
}

export class MemoryConsolidator {
  private rules: ConsolidationRule[];
  private shortTermStore: Map<string, MemoryEntry>;
  private longTermStore: Map<string, MemoryEntry>;
  private archiveStore: Map<string, MemoryEntry>;
  private compressor: MemoryCompressor;
  private listeners: Map<string, Set<EventHandler>>;
  private consolidationCount: number;

  constructor() {
    this.rules = [];
    this.shortTermStore = new Map();
    this.longTermStore = new Map();
    this.archiveStore = new Map();
    this.compressor = new MemoryCompressor();
    this.listeners = new Map();
    this.consolidationCount = 0;

    this.addDefaultRules();
  }

  consolidate(): void {
    const candidates = this.identifyCandidates();

    candidates.sort((a, b) => b.score - a.score);

    for (const candidate of candidates) {
      this.executeConsolidation(candidate);
    }

    this.consolidationCount += 1;
  }

  promote(entryId: string): void {
    const entry = this.findEntry(entryId);
    if (!entry) return;

    const tier = this.findTier(entryId);
    if (!tier) return;

    const promotionOrder: MemoryType[] = [
      "working" as MemoryType,
      "conversation" as MemoryType,
      "long_term" as MemoryType,
    ];

    const currentIndex = promotionOrder.indexOf(tier);
    if (currentIndex >= promotionOrder.length - 1) return;

    const targetTier = promotionOrder[currentIndex + 1];
    this.moveEntry(entryId, tier, targetTier);

    entry.importance = Math.min(1, entry.importance + 0.15);
    entry.updatedAt = new Date().toISOString();

    this.emit("memory:consolidated", {
      entryId,
      from: tier,
      to: targetTier,
    });
  }

  demote(entryId: string): void {
    const entry = this.findEntry(entryId);
    if (!entry) return;

    const tier = this.findTier(entryId);
    if (!tier) return;

    const demotionOrder: MemoryType[] = [
      "long_term" as MemoryType,
      "conversation" as MemoryType,
      "working" as MemoryType,
    ];

    const currentIndex = demotionOrder.indexOf(tier);
    if (currentIndex >= demotionOrder.length - 1) return;

    const targetTier = demotionOrder[currentIndex + 1];
    this.moveEntry(entryId, tier, targetTier);

    entry.importance = Math.max(0, entry.importance - 0.15);
    entry.updatedAt = new Date().toISOString();

    this.emit("memory:consolidated", {
      entryId,
      from: tier,
      to: targetTier,
    });
  }

  archive(entryId: string): void {
    const entry = this.findEntry(entryId);
    if (!entry) return;

    const tier = this.findTier(entryId);
    if (!tier) return;

    const archivedEntry: MemoryEntry = {
      ...entry,
      type: "long_term" as MemoryType,
      importance: entry.importance * 0.5,
      metadata: { ...entry.metadata, archived: true, archivedAt: new Date().toISOString(), originalTier: tier },
      updatedAt: new Date().toISOString(),
    };

    this.removeFromTier(entryId, tier);
    this.archiveStore.set(entryId, archivedEntry);

    this.emit("memory:consolidated", {
      entryId,
      from: tier,
      to: "long_term" as MemoryType,
    });
  }

  sleepConsolidation(): void {
    const now = Date.now();

    const shortTermEntries = Array.from(this.shortTermStore.entries());
    const toPromote: Array<[string, MemoryEntry]> = [];
    const toDemote: Array<[string, MemoryEntry]> = [];

    for (const [id, entry] of shortTermEntries) {
      const ageMs = now - new Date(entry.createdAt).getTime();
      const ageHours = ageMs / 3600000;

      if (entry.accessCount > 3 && entry.importance > 0.6 && ageHours > 1) {
        toPromote.push([id, entry]);
      } else if (entry.accessCount === 0 && entry.importance < 0.3 && ageHours > 24) {
        toDemote.push([id, entry]);
      }
    }

    for (const [id] of toPromote) {
      this.promote(id);
    }

    for (const [id] of toDemote) {
      this.archive(id);
    }

    const lowImportanceLongTerm = Array.from(this.longTermStore.entries())
      .filter(([, entry]) => {
        const ageDays = (now - new Date(entry.lastAccessedAt).getTime()) / 86400000;
        return entry.importance < 0.2 && ageDays > 30;
      });

    for (const [id] of lowImportanceLongTerm) {
      this.archive(id);
    }

    const similarGroups = this.findSimilarGroups();
    for (const group of similarGroups) {
      if (group.length >= 2) {
        const entries = group.map((id) => this.findEntry(id)).filter((e): e is MemoryEntry => e !== null);
        if (entries.length >= 2) {
          const compressed = this.compressor.compress(entries);
          const mergedEntry: MemoryEntry = {
            id: compressed.id,
            type: "long_term" as MemoryType,
            content: compressed.summary,
            embedding: null,
            importance: Math.max(...entries.map((e) => e.importance)) * 0.9,
            accessCount: 0,
            lastAccessedAt: new Date().toISOString(),
            expiresAt: null,
            tags: [...new Set(entries.flatMap((e) => e.tags))],
            source: "consolidation",
            metadata: {
              mergedFrom: entries.map((e) => e.id),
              compressionRatio: compressed.compressionRatio,
              keyPoints: compressed.keyPoints.map((kp) => kp.text),
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          for (const entry of entries) {
            const tier = this.findTier(entry.id);
            if (tier) {
              this.removeFromTier(entry.id, tier);
            }
          }

          this.longTermStore.set(mergedEntry.id, mergedEntry);

          this.emit("memory:consolidated", {
            entryId: mergedEntry.id,
            from: "conversation" as MemoryType,
            to: "long_term" as MemoryType,
          });
        }
      }
    }
  }

  addRule(rule: ConsolidationRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
  }

  getRules(): ConsolidationRule[] {
    return [...this.rules];
  }

  setShortTermStore(store: Map<string, MemoryEntry>): void {
    this.shortTermStore = store;
  }

  setLongTermStore(store: Map<string, MemoryEntry>): void {
    this.longTermStore = store;
  }

  getArchiveStore(): Map<string, MemoryEntry> {
    return this.archiveStore;
  }

  getConsolidationCount(): number {
    return this.consolidationCount;
  }

  private addDefaultRules(): void {
    this.rules.push({
      id: "promote-high-access",
      name: "Promote High Access Entries",
      description: "Promote entries with high access count to long-term memory",
      sourceTier: "conversation" as MemoryType,
      targetTier: "long_term" as MemoryType,
      conditions: [
        { field: "accessCount", operator: "gt", value: 5 },
        { field: "importance", operator: "gte", value: 0.6 },
      ],
      action: { type: "promote", params: {} },
      priority: 10,
      enabled: true,
    });

    this.rules.push({
      id: "demote-low-importance",
      name: "Demote Low Importance Entries",
      description: "Demote entries with low importance and low access",
      sourceTier: "conversation" as MemoryType,
      targetTier: "working" as MemoryType,
      conditions: [
        { field: "importance", operator: "lt", value: 0.2 },
        { field: "accessCount", operator: "lt", value: 2 },
      ],
      action: { type: "demote", params: {} },
      priority: 5,
      enabled: true,
    });

    this.rules.push({
      id: "archive-stale",
      name: "Archive Stale Entries",
      description: "Archive entries not accessed in a long time",
      sourceTier: "long_term" as MemoryType,
      targetTier: "long_term" as MemoryType,
      conditions: [
        { field: "importance", operator: "lt", value: 0.1 },
      ],
      action: { type: "archive", params: {} },
      priority: 3,
      enabled: true,
    });
  }

  private identifyCandidates(): ConsolidationCandidate[] {
    const candidates: ConsolidationCandidate[] = [];
    const now = Date.now();

    for (const [id, entry] of this.shortTermStore) {
      for (const rule of this.rules) {
        if (!rule.enabled) continue;
        if (rule.sourceTier !== "conversation" as MemoryType) continue;

        if (this.matchesConditions(entry, rule.conditions, now)) {
          candidates.push({
            entryId: id,
            entry,
            currentTier: "conversation" as MemoryType,
            targetTier: rule.targetTier,
            action: rule.action.type,
            score: this.computeConsolidationScore(entry, rule),
          });
        }
      }
    }

    for (const [id, entry] of this.longTermStore) {
      for (const rule of this.rules) {
        if (!rule.enabled) continue;
        if (rule.sourceTier !== "long_term" as MemoryType) continue;

        if (this.matchesConditions(entry, rule.conditions, now)) {
          candidates.push({
            entryId: id,
            entry,
            currentTier: "long_term" as MemoryType,
            targetTier: rule.targetTier,
            action: rule.action.type,
            score: this.computeConsolidationScore(entry, rule),
          });
        }
      }
    }

    return candidates;
  }

  private matchesConditions(entry: MemoryEntry, conditions: ConsolidationRule["conditions"], now: number): boolean {
    for (const condition of conditions) {
      const fieldValue = this.getFieldValue(entry, condition.field, now);
      if (!this.evaluateCondition(fieldValue, condition.operator, condition.value)) {
        return false;
      }
    }
    return true;
  }

  private getFieldValue(entry: MemoryEntry, field: string, now: number): unknown {
    switch (field) {
      case "accessCount": return entry.accessCount;
      case "importance": return entry.importance;
      case "ageMs": return now - new Date(entry.createdAt).getTime();
      case "ageHours": return (now - new Date(entry.createdAt).getTime()) / 3600000;
      case "ageDays": return (now - new Date(entry.createdAt).getTime()) / 86400000;
      case "lastAccessedMs": return now - new Date(entry.lastAccessedAt).getTime();
      default: return entry.metadata[field];
    }
  }

  private evaluateCondition(fieldValue: unknown, operator: string, conditionValue: unknown): boolean {
    if (fieldValue === undefined || fieldValue === null) return false;

    const numField = typeof fieldValue === "number" ? fieldValue : Number(fieldValue);
    const numValue = typeof conditionValue === "number" ? conditionValue : Number(conditionValue);

    switch (operator) {
      case "eq": return fieldValue === conditionValue;
      case "neq": return fieldValue !== conditionValue;
      case "gt": return numField > numValue;
      case "gte": return numField >= numValue;
      case "lt": return numField < numValue;
      case "lte": return numField <= numValue;
      case "in": return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
      case "contains": return typeof fieldValue === "string" && typeof conditionValue === "string" && fieldValue.includes(conditionValue);
      default: return false;
    }
  }

  private computeConsolidationScore(entry: MemoryEntry, rule: ConsolidationRule): number {
    let score = rule.priority * 0.1;
    score += entry.importance * 0.3;
    score += Math.min(entry.accessCount / 10, 1) * 0.2;
    return score;
  }

  private executeConsolidation(candidate: ConsolidationCandidate): void {
    switch (candidate.action) {
      case "promote":
        this.promote(candidate.entryId);
        break;
      case "demote":
        this.demote(candidate.entryId);
        break;
      case "archive":
        this.archive(candidate.entryId);
        break;
      case "delete":
        this.removeFromTier(candidate.entryId, candidate.currentTier);
        this.emit("memory:deleted", { entryId: candidate.entryId, tier: candidate.currentTier });
        break;
      case "merge":
        break;
    }
  }

  private findEntry(id: string): MemoryEntry | null {
    return this.shortTermStore.get(id) ?? this.longTermStore.get(id) ?? this.archiveStore.get(id) ?? null;
  }

  private findTier(id: string): MemoryType | null {
    if (this.shortTermStore.has(id)) return "conversation" as MemoryType;
    if (this.longTermStore.has(id)) return "long_term" as MemoryType;
    if (this.archiveStore.has(id)) return "long_term" as MemoryType;
    return null;
  }

  private moveEntry(id: string, from: MemoryType, to: MemoryType): void {
    const entry = this.findEntry(id);
    if (!entry) return;

    this.removeFromTier(id, from);
    this.addToTier(id, entry, to);
  }

  private removeFromTier(id: string, tier: MemoryType): void {
    switch (tier) {
      case "conversation" as MemoryType:
        this.shortTermStore.delete(id);
        break;
      case "long_term" as MemoryType:
        this.longTermStore.delete(id);
        break;
    }
  }

  private addToTier(id: string, entry: MemoryEntry, tier: MemoryType): void {
    switch (tier) {
      case "conversation" as MemoryType:
        this.shortTermStore.set(id, entry);
        break;
      case "long_term" as MemoryType:
        this.longTermStore.set(id, entry);
        break;
    }
  }

  private findSimilarGroups(): string[][] {
    const groups: string[][] = [];
    const processed = new Set<string>();
    const longTermEntries = Array.from(this.longTermStore.entries());

    for (let i = 0; i < longTermEntries.length; i++) {
      const [idA, entryA] = longTermEntries[i];
      if (processed.has(idA)) continue;

      const group: string[] = [idA];

      for (let j = i + 1; j < longTermEntries.length; j++) {
        const [idB, entryB] = longTermEntries[j];
        if (processed.has(idB)) continue;

        const tagOverlap = entryA.tags.filter((t) => entryB.tags.includes(t)).length;
        const minTags = Math.min(entryA.tags.length, entryB.tags.length);
        if (minTags > 0 && tagOverlap / minTags > 0.5) {
          const contentSimilarity = this.textSimilarity(entryA.content, entryB.content);
          if (contentSimilarity > 0.6) {
            group.push(idB);
          }
        }
      }

      if (group.length >= 2) {
        groups.push(group);
        for (const id of group) {
          processed.add(id);
        }
      }
    }

    return groups;
  }

  private textSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
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
