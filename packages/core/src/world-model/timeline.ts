import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { EventSeverity } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import { Event } from "./event.js";
import type { EventRecord, CausalChain, EventPattern } from "./types.js";

export class Timeline {
  private events: Map<string, EventRecord>;
  private causalLinks: Array<{ causeId: string; effectId: string; strength: number; delay: number }>;
  private timeIndex: Map<number, Set<string>>;
  private typeIndex: Map<string, Set<string>>;
  private entityIndex: Map<string, Set<string>>;
  private severityIndex: Map<EventSeverity, Set<string>>;
  private startTime: string;
  private endTime: string;
  private resolution: number;

  constructor(resolution: number = 1000) {
    this.events = new Map();
    this.causalLinks = [];
    this.timeIndex = new Map();
    this.typeIndex = new Map();
    this.entityIndex = new Map();
    this.severityIndex = new Map();
    this.startTime = new Date().toISOString();
    this.endTime = new Date().toISOString();
    this.resolution = resolution;
  }

  addEvent(params: { name: string; description?: string; timestamp?: string; severity?: EventSeverity; entityId: string; payload?: Record<string, unknown>; duration?: number | null }): Result<EventRecord, ValidationError> {
    const result = Event.create(params);
    if (!result.ok) {
      return result;
    }

    const record = result.value;
    this.events.set(record.id, record);
    this.indexEvent(record);
    this.updateTimeBounds(record.timestamp);

    return ok(record);
  }

  removeEvent(id: string): Result<true, ValidationError> {
    const event = this.events.get(id);
    if (!event) {
      return err(new ValidationError("Event not found", { eventId: id }));
    }

    this.unindexEvent(event);

    this.causalLinks = this.causalLinks.filter(
      (link) => link.causeId !== id && link.effectId !== id
    );

    for (const [eid, evt] of this.events) {
      if (evt.causeIds.has(id)) {
        const updated = Event.clone(evt);
        updated.causeIds.delete(id);
        updated.updatedAt = new Date().toISOString();
        this.events.set(eid, updated);
      }
      if (evt.effectIds.has(id)) {
        const updated = Event.clone(evt);
        updated.effectIds.delete(id);
        updated.updatedAt = new Date().toISOString();
        this.events.set(eid, updated);
      }
    }

    this.events.delete(id);
    return ok(true);
  }

  addCausalLink(causeId: string, effectId: string, strength: number = 1.0, delay: number = 0): Result<true, ValidationError> {
    const cause = this.events.get(causeId);
    if (!cause) {
      return err(new ValidationError("Cause event not found", { causeId }));
    }

    const effect = this.events.get(effectId);
    if (!effect) {
      return err(new ValidationError("Effect event not found", { effectId }));
    }

    if (causeId === effectId) {
      return err(new ValidationError("An event cannot cause itself", { eventId: causeId }));
    }

    const existingLink = this.causalLinks.find(
      (l) => l.causeId === causeId && l.effectId === effectId
    );
    if (existingLink) {
      existingLink.strength = strength;
      existingLink.delay = delay;
      return ok(true);
    }

    this.causalLinks.push({ causeId, effectId, strength, delay });

    const updatedCause = Event.linkEffect(cause, effectId);
    if (updatedCause.ok) {
      this.events.set(causeId, updatedCause.value);
    }

    const updatedEffect = Event.linkEffect(effect, causeId);
    if (!updatedEffect.ok) {
      const updatedEffectAlt = Event.linkCause(effect, causeId);
      if (updatedEffectAlt.ok) {
        this.events.set(effectId, updatedEffectAlt.value);
      }
    }

    return ok(true);
  }

  queryByTime(start: string, end: string): EventRecord[] {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const results: EventRecord[] = [];

    for (const event of this.events.values()) {
      const eventTime = new Date(event.timestamp).getTime();
      if (eventTime >= startTime && eventTime <= endTime) {
        results.push(event);
      }
    }

    return results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  queryByType(name: string): EventRecord[] {
    const ids = this.typeIndex.get(name);
    if (!ids) return [];

    const results: EventRecord[] = [];
    for (const id of ids) {
      const event = this.events.get(id);
      if (event) results.push(event);
    }

    return results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  queryByEntity(entityId: string): EventRecord[] {
    const ids = this.entityIndex.get(entityId);
    if (!ids) return [];

    const results: EventRecord[] = [];
    for (const id of ids) {
      const event = this.events.get(id);
      if (event) results.push(event);
    }

    return results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  queryBySeverity(severity: EventSeverity): EventRecord[] {
    const ids = this.severityIndex.get(severity);
    if (!ids) return [];

    const results: EventRecord[] = [];
    for (const id of ids) {
      const event = this.events.get(id);
      if (event) results.push(event);
    }

    return results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  getCausalChain(eventId: string, maxDepth: number = 50): Result<CausalChain, ValidationError> {
    return Event.buildCausalChain(this.events, eventId, maxDepth);
  }

  predictConsequence(eventId: string, depth: number = 3): EventRecord[] {
    const event = this.events.get(eventId);
    if (!event) return [];

    const predictions: EventRecord[] = [];
    const visited = new Set<string>();
    visited.add(eventId);

    const queue: Array<{ id: string; currentDepth: number }> = [{ id: eventId, currentDepth: 0 }];

    while (queue.length > 0) {
      const { id, currentDepth } = queue.shift()!;

      if (currentDepth >= depth) continue;

      const directEffects = this.causalLinks.filter((l) => l.causeId === id);
      for (const link of directEffects) {
        if (visited.has(link.effectId)) continue;
        visited.add(link.effectId);

        const effectEvent = this.events.get(link.effectId);
        if (effectEvent) {
          predictions.push(effectEvent);
          queue.push({ id: link.effectId, currentDepth: currentDepth + 1 });
        }
      }

      if (directEffects.length === 0 && currentDepth < depth) {
        const similarEvents = this.findSimilarEvents(id);
        for (const similarId of similarEvents) {
          if (visited.has(similarId)) continue;

          const similarEffects = this.causalLinks.filter((l) => l.causeId === similarId);
          for (const link of similarEffects) {
            if (visited.has(link.effectId)) continue;
            visited.add(link.effectId);

            const effectEvent = this.events.get(link.effectId);
            if (effectEvent) {
              const predictedEvent = Event.clone(effectEvent);
              predictedEvent.id = `pred_${effectEvent.id}`;
              predictedEvent.name = `[Predicted] ${effectEvent.name}`;
              predictions.push(predictedEvent);
            }
          }
        }
      }
    }

    return predictions;
  }

  detectPatterns(minOccurrences: number = 3, windowMs: number = 86400000): EventPattern[] {
    const patterns: EventPattern[] = [];
    const eventTypes = new Map<string, EventRecord[]>();

    for (const event of this.events.values()) {
      if (!eventTypes.has(event.name)) {
        eventTypes.set(event.name, []);
      }
      eventTypes.get(event.name)!.push(event);
    }

    for (const [name, events] of eventTypes) {
      if (events.length < minOccurrences) continue;

      const sorted = events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      let totalInterval = 0;
      let intervalCount = 0;

      for (let i = 1; i < sorted.length; i++) {
        const interval = new Date(sorted[i].timestamp).getTime() - new Date(sorted[i - 1].timestamp).getTime();
        if (interval > 0 && interval < windowMs) {
          totalInterval += interval;
          intervalCount++;
        }
      }

      if (intervalCount < minOccurrences - 1) continue;

      const avgInterval = totalInterval / intervalCount;
      const variance = sorted.slice(1).reduce((sum, evt, i) => {
        const interval = new Date(evt.timestamp).getTime() - new Date(sorted[i].timestamp).getTime();
        return sum + Math.pow(interval - avgInterval, 2);
      }, 0) / intervalCount;

      const stdDev = Math.sqrt(variance);
      const confidence = Math.max(0, Math.min(1, 1 - (stdDev / avgInterval)));

      if (confidence > 0.3) {
        const relatedTypes = this.findRelatedEventTypes(name);
        patterns.push({
          id: `pattern_${name}_${Date.now()}`,
          name: `Recurring: ${name}`,
          eventTypes: [name, ...relatedTypes],
          frequency: sorted.length,
          avgInterval,
          confidence,
        });
      }
    }

    const causalPatterns = this.detectCausalPatterns(minOccurrences);
    patterns.push(...causalPatterns);

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  compress(similarityThreshold: number = 0.8): number {
    let compressed = 0;
    const events = Array.from(this.events.values());
    const merged = new Set<string>();

    for (let i = 0; i < events.length; i++) {
      if (merged.has(events[i].id)) continue;

      for (let j = i + 1; j < events.length; j++) {
        if (merged.has(events[j].id)) continue;

        const similarity = this.computeEventSimilarity(events[i], events[j]);
        if (similarity >= similarityThreshold) {
          const timeDiff = Math.abs(
            new Date(events[i].timestamp).getTime() - new Date(events[j].timestamp).getTime()
          );

          if (timeDiff < this.resolution) {
            this.mergeEvents(events[i].id, events[j].id);
            merged.add(events[j].id);
            compressed++;
          }
        }
      }
    }

    return compressed;
  }

  replay(fromTimestamp?: string, toTimestamp?: string): EventRecord[] {
    let events = Array.from(this.events.values());

    if (fromTimestamp) {
      const fromTime = new Date(fromTimestamp).getTime();
      events = events.filter((e) => new Date(e.timestamp).getTime() >= fromTime);
    }

    if (toTimestamp) {
      const toTime = new Date(toTimestamp).getTime();
      events = events.filter((e) => new Date(e.timestamp).getTime() <= toTime);
    }

    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  getEvent(id: string): EventRecord | undefined {
    return this.events.get(id);
  }

  eventCount(): number {
    return this.events.size;
  }

  causalLinkCount(): number {
    return this.causalLinks.length;
  }

  getStartTime(): string {
    return this.startTime;
  }

  getEndTime(): string {
    return this.endTime;
  }

  getAllEvents(): EventRecord[] {
    return Array.from(this.events.values());
  }

  getAllCausalLinks(): Array<{ causeId: string; effectId: string; strength: number; delay: number }> {
    return [...this.causalLinks];
  }

  clear(): void {
    this.events.clear();
    this.causalLinks = [];
    this.timeIndex.clear();
    this.typeIndex.clear();
    this.entityIndex.clear();
    this.severityIndex.clear();
  }

  private indexEvent(event: EventRecord): void {
    const timeBucket = Math.floor(new Date(event.timestamp).getTime() / this.resolution);
    if (!this.timeIndex.has(timeBucket)) {
      this.timeIndex.set(timeBucket, new Set());
    }
    this.timeIndex.get(timeBucket)!.add(event.id);

    if (!this.typeIndex.has(event.name)) {
      this.typeIndex.set(event.name, new Set());
    }
    this.typeIndex.get(event.name)!.add(event.id);

    if (!this.entityIndex.has(event.entityId)) {
      this.entityIndex.set(event.entityId, new Set());
    }
    this.entityIndex.get(event.entityId)!.add(event.id);

    if (!this.severityIndex.has(event.severity)) {
      this.severityIndex.set(event.severity, new Set());
    }
    this.severityIndex.get(event.severity)!.add(event.id);
  }

  private unindexEvent(event: EventRecord): void {
    const timeBucket = Math.floor(new Date(event.timestamp).getTime() / this.resolution);
    const timeSet = this.timeIndex.get(timeBucket);
    if (timeSet) {
      timeSet.delete(event.id);
      if (timeSet.size === 0) this.timeIndex.delete(timeBucket);
    }

    const typeSet = this.typeIndex.get(event.name);
    if (typeSet) {
      typeSet.delete(event.id);
      if (typeSet.size === 0) this.typeIndex.delete(event.name);
    }

    const entitySet = this.entityIndex.get(event.entityId);
    if (entitySet) {
      entitySet.delete(event.id);
      if (entitySet.size === 0) this.entityIndex.delete(event.entityId);
    }

    const severitySet = this.severityIndex.get(event.severity);
    if (severitySet) {
      severitySet.delete(event.id);
      if (severitySet.size === 0) this.severityIndex.delete(event.severity);
    }
  }

  private updateTimeBounds(timestamp: string): void {
    const time = new Date(timestamp).getTime();
    if (time < new Date(this.startTime).getTime()) {
      this.startTime = timestamp;
    }
    if (time > new Date(this.endTime).getTime()) {
      this.endTime = timestamp;
    }
  }

  private findSimilarEvents(eventId: string): string[] {
    const event = this.events.get(eventId);
    if (!event) return [];

    const similar: string[] = [];
    for (const [id, other] of this.events) {
      if (id === eventId) continue;
      if (other.name === event.name && other.entityId === event.entityId) {
        similar.push(id);
      }
    }

    return similar;
  }

  private findRelatedEventTypes(eventType: string): string[] {
    const related = new Set<string>();
    const eventIds = this.typeIndex.get(eventType) ?? new Set();

    for (const eventId of eventIds) {
      for (const link of this.causalLinks) {
        if (link.causeId === eventId) {
          const effect = this.events.get(link.effectId);
          if (effect && effect.name !== eventType) {
            related.add(effect.name);
          }
        }
        if (link.effectId === eventId) {
          const cause = this.events.get(link.causeId);
          if (cause && cause.name !== eventType) {
            related.add(cause.name);
          }
        }
      }
    }

    return Array.from(related);
  }

  private detectCausalPatterns(minOccurrences: number): EventPattern[] {
    const patterns: EventPattern[] = [];
    const pairCounts = new Map<string, { cause: string; effect: string; count: number; totalDelay: number }>();

    for (const link of this.causalLinks) {
      const cause = this.events.get(link.causeId);
      const effect = this.events.get(link.effectId);
      if (!cause || !effect) continue;

      const key = `${cause.name}->${effect.name}`;
      if (!pairCounts.has(key)) {
        pairCounts.set(key, { cause: cause.name, effect: effect.name, count: 0, totalDelay: 0 });
      }
      const entry = pairCounts.get(key)!;
      entry.count++;
      entry.totalDelay += link.delay;
    }

    for (const [, entry] of pairCounts) {
      if (entry.count >= minOccurrences) {
        patterns.push({
          id: `causal_${entry.cause}_${entry.effect}_${Date.now()}`,
          name: `Causal: ${entry.cause} -> ${entry.effect}`,
          eventTypes: [entry.cause, entry.effect],
          frequency: entry.count,
          avgInterval: entry.totalDelay / entry.count,
          confidence: Math.min(1, entry.count / 10),
        });
      }
    }

    return patterns;
  }

  private computeEventSimilarity(a: EventRecord, b: EventRecord): number {
    let score = 0;
    let factors = 0;

    if (a.name === b.name) {
      score += 0.4;
    }
    factors++;

    if (a.entityId === b.entityId) {
      score += 0.3;
    }
    factors++;

    if (a.severity === b.severity) {
      score += 0.1;
    }
    factors++;

    const aKeys = Object.keys(a.payload).sort();
    const bKeys = Object.keys(b.payload).sort();
    if (aKeys.join(",") === bKeys.join(",")) {
      score += 0.2;
    }
    factors++;

    return score;
  }

  private mergeEvents(keepId: string, removeId: string): void {
    const keep = this.events.get(keepId);
    const remove = this.events.get(removeId);
    if (!keep || !remove) return;

    const merged = Event.clone(keep);
    merged.payload = { ...keep.payload, ...remove.payload, _mergedFrom: remove.id };
    merged.updatedAt = new Date().toISOString();
    merged.version += 1;

    for (const causeId of remove.causeIds) {
      merged.causeIds.add(causeId);
    }

    for (const effectId of remove.effectIds) {
      merged.effectIds.add(effectId);
    }

    this.unindexEvent(remove);
    this.events.delete(removeId);

    this.causalLinks = this.causalLinks.map((link) => {
      if (link.causeId === removeId) return { ...link, causeId: keepId };
      if (link.effectId === removeId) return { ...link, effectId: keepId };
      return link;
    });

    this.events.set(keepId, merged);
    this.indexEvent(merged);
  }
}
