import type { Event, CausalLink } from '@paracosm/shared';
import { generateId, ok, err, type Result } from '@paracosm/shared';
import type { TimelineQueryOptions, CausalChainResult, PatternDetectionResult } from './types.js';

export class Timeline {
  private id: string;
  private name: string;
  private events: Map<string, Event> = new Map();
  private causalLinks: Map<string, CausalLink> = new Map();
  private eventIndexByTime: Array<{ id: string; timestamp: number }> = [];
  private entityEventIndex: Map<string, Set<string>> = new Map();
  private dirty: boolean = false;
  private listeners: Array<(event: string, data: unknown) => void> = [];

  constructor(id?: string, name?: string) {
    this.id = id ?? generateId();
    this.name = name ?? 'default';
  }

  on(listener: (event: string, data: unknown) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  private emit(event: string, data: unknown): void {
    for (const listener of this.listeners) {
      listener(event, data);
    }
  }

  private rebuildTimeIndex(): void {
    if (!this.dirty) return;
    this.eventIndexByTime = Array.from(this.events.values())
      .map((e) => ({ id: e.id, timestamp: e.timestamp.getTime() }))
      .sort((a, b) => a.timestamp - b.timestamp);
    this.dirty = false;
  }

  addEvent(event: Omit<Event, 'id'> & { id?: string }): Result<Event> {
    const id = event.id ?? generateId();
    if (this.events.has(id)) {
      return err(new Error(`Event with id ${id} already exists`));
    }
    const newEvent: Event = { ...event, id };
    this.events.set(id, newEvent);
    this.dirty = true;
    for (const entityId of newEvent.entities) {
      const set = this.entityEventIndex.get(entityId) ?? new Set();
      set.add(id);
      this.entityEventIndex.set(entityId, set);
    }
    this.emit('event:added', newEvent);
    return ok(newEvent);
  }

  removeEvent(id: string): Result<boolean> {
    const event = this.events.get(id);
    if (!event) {
      return err(new Error(`Event with id ${id} not found`));
    }
    this.events.delete(id);
    this.dirty = true;
    for (const entityId of event.entities) {
      const set = this.entityEventIndex.get(entityId);
      if (set) {
        set.delete(id);
        if (set.size === 0) this.entityEventIndex.delete(entityId);
      }
    }
    const linksToRemove: string[] = [];
    for (const [linkId, link] of this.causalLinks) {
      if (link.causeEventId === id || link.effectEventId === id) {
        linksToRemove.push(linkId);
      }
    }
    for (const linkId of linksToRemove) {
      this.causalLinks.delete(linkId);
    }
    this.emit('event:removed', event);
    return ok(true);
  }

  updateEvent(id: string, updates: Partial<Omit<Event, 'id'>>): Result<Event> {
    const event = this.events.get(id);
    if (!event) {
      return err(new Error(`Event with id ${id} not found`));
    }
    const oldEntities = new Set(event.entities);
    const updated: Event = { ...event, ...updates, id };
    this.events.set(id, updated);
    if (updates.timestamp) this.dirty = true;
    if (updates.entities) {
      for (const entityId of oldEntities) {
        if (!updated.entities.includes(entityId)) {
          const set = this.entityEventIndex.get(entityId);
          if (set) {
            set.delete(id);
            if (set.size === 0) this.entityEventIndex.delete(entityId);
          }
        }
      }
      for (const entityId of updated.entities) {
        if (!oldEntities.has(entityId)) {
          const set = this.entityEventIndex.get(entityId) ?? new Set();
          set.add(id);
          this.entityEventIndex.set(entityId, set);
        }
      }
    }
    this.emit('event:updated', { before: event, after: updated });
    return ok(updated);
  }

  getEvent(id: string): Event | undefined {
    return this.events.get(id);
  }

  addCausalLink(link: Omit<CausalLink, 'id'> & { id?: string }): Result<CausalLink> {
    const id = link.id ?? generateId();
    if (this.causalLinks.has(id)) {
      return err(new Error(`Causal link with id ${id} already exists`));
    }
    if (!this.events.has(link.causeEventId)) {
      return err(new Error(`Cause event ${link.causeEventId} not found`));
    }
    if (!this.events.has(link.effectEventId)) {
      return err(new Error(`Effect event ${link.effectEventId} not found`));
    }
    const newLink: CausalLink = { ...link, id };
    this.causalLinks.set(id, newLink);
    this.emit('causal_link:added', newLink);
    return ok(newLink);
  }

  removeCausalLink(id: string): Result<boolean> {
    const link = this.causalLinks.get(id);
    if (!link) {
      return err(new Error(`Causal link with id ${id} not found`));
    }
    this.causalLinks.delete(id);
    this.emit('causal_link:removed', link);
    return ok(true);
  }

  queryByTime(options: TimelineQueryOptions = {}): Event[] {
    this.rebuildTimeIndex();
    let results = this.eventIndexByTime;
    if (options.startTime) {
      const startMs = options.startTime.getTime();
      results = results.filter((e) => e.timestamp >= startMs);
    }
    if (options.endTime) {
      const endMs = options.endTime.getTime();
      results = results.filter((e) => e.timestamp <= endMs);
    }
    let events = results
      .map((r) => this.events.get(r.id))
      .filter((e): e is Event => e !== undefined);
    if (options.entityIds && options.entityIds.length > 0) {
      const entitySet = new Set(options.entityIds);
      events = events.filter((e) => e.entities.some((id) => entitySet.has(id)));
    }
    if (options.minProbability !== undefined) {
      events = events.filter((e) => e.probability >= options.minProbability!);
    }
    if (options.limit) {
      events = events.slice(0, options.limit);
    }
    return events;
  }

  getCausalChain(eventId: string, direction: 'forward' | 'backward' | 'both' = 'forward', maxDepth: number = 20): CausalChainResult {
    const events: Event[] = [];
    const links: CausalLink[] = [];
    const visited = new Set<string>();
    const totalStrength = { value: 0 };
    const totalDelay = { value: 0 };

    const traverse = (currentId: string, depth: number, dir: 'forward' | 'backward' | 'both') => {
      if (depth > maxDepth || visited.has(currentId)) return;
      visited.add(currentId);
      const event = this.events.get(currentId);
      if (!event) return;
      events.push(event);
      if (dir === 'forward' || dir === 'both') {
        for (const [, link] of this.causalLinks) {
          if (link.causeEventId === currentId && !visited.has(link.effectEventId)) {
            links.push(link);
            totalStrength.value += link.strength;
            totalDelay.value += link.delay;
            traverse(link.effectEventId, depth + 1, dir);
          }
        }
      }
      if (dir === 'backward' || dir === 'both') {
        for (const [, link] of this.causalLinks) {
          if (link.effectEventId === currentId && !visited.has(link.causeEventId)) {
            links.push(link);
            totalStrength.value += link.strength;
            totalDelay.value += link.delay;
            traverse(link.causeEventId, depth + 1, dir);
          }
        }
      }
    };

    traverse(eventId, 0, direction);
    return {
      events,
      links,
      totalStrength: totalStrength.value,
      totalDelay: totalDelay.value,
    };
  }

  predictConsequence(eventId: string, depth: number = 3): Array<{ event: Event; probability: number; path: string[] }> {
    const predictions: Array<{ event: Event; probability: number; path: string[] }> = [];
    const visited = new Set<string>();

    const predict = (currentId: string, currentProb: number, currentPath: string[], currentDepth: number) => {
      if (currentDepth > depth || visited.has(currentId)) return;
      visited.add(currentId);
      for (const [, link] of this.causalLinks) {
        if (link.causeEventId === currentId) {
          const effectEvent = this.events.get(link.effectEventId);
          if (effectEvent) {
            const prob = currentProb * link.strength * effectEvent.probability;
            const path = [...currentPath, link.effectEventId];
            predictions.push({
              event: effectEvent,
              probability: prob,
              path,
            });
            if (prob > 0.1) {
              predict(link.effectEventId, prob, path, currentDepth + 1);
            }
          }
        }
      }
    };

    const startEvent = this.events.get(eventId);
    if (startEvent) {
      predict(eventId, startEvent.probability, [eventId], 0);
    }
    predictions.sort((a, b) => b.probability - a.probability);
    return predictions;
  }

  detectPatterns(minOccurrences: number = 2, windowMs: number = 3600000): PatternDetectionResult[] {
    const patterns: PatternDetectionResult[] = [];
    const events = this.queryByTime({});
    if (events.length < minOccurrences) return patterns;

    const entityEventMap = new Map<string, Event[]>();
    for (const event of events) {
      for (const entityId of event.entities) {
        const list = entityEventMap.get(entityId) ?? [];
        list.push(event);
        entityEventMap.set(entityId, list);
      }
    }

    for (const [entityId, entityEvents] of entityEventMap) {
      if (entityEvents.length < minOccurrences) continue;
      const sorted = entityEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = sorted[i + 1].timestamp.getTime() - sorted[i].timestamp.getTime();
        if (gap > windowMs) continue;
        const patternKey = `${sorted[i].name}->${sorted[i + 1].name}`;
        let occurrences = 1;
        for (let j = i + 1; j < sorted.length - 1; j++) {
          const nextGap = sorted[j + 1].timestamp.getTime() - sorted[j].timestamp.getTime();
          if (Math.abs(nextGap - gap) < gap * 0.2) {
            occurrences++;
          }
        }
        if (occurrences >= minOccurrences) {
          const confidence = Math.min(occurrences / sorted.length, 1.0);
          patterns.push({
            pattern: patternKey,
            occurrences,
            confidence,
            events: [sorted.slice(i, i + occurrences + 1)],
            description: `Entity ${entityId} shows recurring pattern: ${patternKey} with ${occurrences} occurrences`,
          });
        }
      }
    }

    patterns.sort((a, b) => b.confidence - a.confidence);
    return patterns;
  }

  getEventsForEntity(entityId: string): Event[] {
    const ids = this.entityEventIndex.get(entityId);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.events.get(id))
      .filter((e): e is Event => e !== undefined)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  getEventCount(): number {
    return this.events.size;
  }

  getCausalLinkCount(): number {
    return this.causalLinks.size;
  }

  getAllEvents(): Event[] {
    return Array.from(this.events.values());
  }

  getAllCausalLinks(): CausalLink[] {
    return Array.from(this.causalLinks.values());
  }

  getStartTime(): Date | null {
    this.rebuildTimeIndex();
    if (this.eventIndexByTime.length === 0) return null;
    return new Date(this.eventIndexByTime[0].timestamp);
  }

  getEndTime(): Date | null {
    this.rebuildTimeIndex();
    if (this.eventIndexByTime.length === 0) return null;
    return new Date(this.eventIndexByTime[this.eventIndexByTime.length - 1].timestamp);
  }

  clear(): void {
    this.events.clear();
    this.causalLinks.clear();
    this.eventIndexByTime = [];
    this.entityEventIndex.clear();
    this.dirty = false;
    this.emit('timeline:cleared', null);
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }
}
