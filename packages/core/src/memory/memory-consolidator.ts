import type { MemoryEntry, MemoryType } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';
import type { ConsolidationPlan } from './types.js';

const logger = createLogger('MemoryConsolidator');

export class MemoryConsolidator {
  private threshold: number;

  constructor(threshold: number = 0.7) {
    this.threshold = threshold;
  }

  evaluateForConsolidation(entries: MemoryEntry[]): ConsolidationPlan[] {
    const plans: ConsolidationPlan[] = [];
    for (const entry of entries) {
      const importance = entry.importance ?? 0;
      const accessFrequency = entry.accessCount;
      const age = Date.now() - entry.createdAt.getTime();
      const ageDays = age / 86400000;
      if (entry.type === 'working' && (importance > this.threshold || accessFrequency > 5)) {
        plans.push({
          entriesToConsolidate: [entry.id],
          targetMemoryType: 'working',
          strategy: 'promote',
          reason: `High importance (${importance.toFixed(2)}) or frequent access (${accessFrequency})`,
        });
      }
      if (entry.type === 'working' && (importance > 0.8 || (accessFrequency > 10 && ageDays > 1))) {
        plans.push({
          entriesToConsolidate: [entry.id],
          targetMemoryType: 'long_term',
          strategy: 'promote',
          reason: `Very high importance or sustained frequent access over time`,
        });
      }
      if (entry.type === 'working' && importance < 0.2 && accessFrequency < 2 && age > 300000) {
        plans.push({
          entriesToConsolidate: [entry.id],
          targetMemoryType: 'working',
          strategy: 'archive',
          reason: `Low importance and infrequent access`,
        });
      }
    }
    const similarGroups = this.findSimilarEntries(entries);
    for (const group of similarGroups) {
      if (group.length > 1) {
        plans.push({
          entriesToConsolidate: group.map((e) => e.id),
          targetMemoryType: group[0].type,
          strategy: 'compress',
          reason: `${group.length} similar entries can be compressed`,
        });
      }
    }
    return plans;
  }

  private findSimilarEntries(entries: MemoryEntry[]): MemoryEntry[][] {
    const groups: MemoryEntry[][] = [];
    const assigned = new Set<string>();
    for (let i = 0; i < entries.length; i++) {
      if (assigned.has(entries[i].id)) continue;
      const group: MemoryEntry[] = [entries[i]];
      assigned.add(entries[i].id);
      for (let j = i + 1; j < entries.length; j++) {
        if (assigned.has(entries[j].id)) continue;
        if (this.areSimilar(entries[i], entries[j])) {
          group.push(entries[j]);
          assigned.add(entries[j].id);
        }
      }
      if (group.length > 1) groups.push(group);
    }
    return groups;
  }

  private areSimilar(a: MemoryEntry, b: MemoryEntry): boolean {
    if (a.type !== b.type) return false;
    if (a.id === b.id) return true;
    const aWords = new Set(a.content.toLowerCase().split(/\s+/));
    const bWords = new Set(b.content.toLowerCase().split(/\s+/));
    const intersection = new Set([...aWords].filter((w) => bWords.has(w)));
    const union = new Set([...aWords, ...bWords]);
    if (union.size === 0) return false;
    return intersection.size / union.size > 0.6;
  }
}
