import type { EpisodicEvent } from "@paracosm/shared";
import { generateId } from "@paracosm/shared";
import type { Episode, Lesson, TemporalIndex, MemoryEvents, MemoryEventName } from "./types.js";

type EventHandler = (data: unknown) => void;

export class EpisodicMemory {
  private episodes: Map<string, Episode>;
  private temporalIndex: TemporalIndex;
  private lessonStore: Map<string, Lesson>;
  private listeners: Map<string, Set<EventHandler>>;

  constructor() {
    this.episodes = new Map();
    this.temporalIndex = {
      byHour: new Map(),
      byDay: new Map(),
      byMonth: new Map(),
      byYear: new Map(),
    };
    this.lessonStore = new Map();
    this.listeners = new Map();
  }

  record(episode: Partial<Episode> & { title: string; description: string }): void {
    const now = new Date().toISOString();
    const id = episode.id ?? generateId();

    const fullEpisode: Episode = {
      id,
      title: episode.title,
      description: episode.description,
      startTime: episode.startTime ?? now,
      endTime: episode.endTime ?? now,
      events: episode.events ?? [],
      emotionalValence: episode.emotionalValence ?? 0,
      significance: episode.significance ?? 0.5,
      lessonsLearned: episode.lessonsLearned ?? [],
      relatedEpisodes: episode.relatedEpisodes ?? [],
      tags: episode.tags ?? [],
      metadata: episode.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };

    this.episodes.set(id, fullEpisode);
    this.updateTemporalIndex(id, fullEpisode.startTime);

    if (fullEpisode.significance > 0.7) {
      const lessons = this.extractLessons(fullEpisode);
      for (const lesson of lessons) {
        this.lessonStore.set(lesson.id, lesson);
      }
    }

    this.emit("memory:stored", { entryId: id, tier: "episodic" as const });
  }

  replay(id: string): Episode {
    const episode = this.episodes.get(id);
    if (!episode) {
      throw new Error(`Episode not found: ${id}`);
    }
    return { ...episode, events: [...episode.events] };
  }

  search(query: {
    text?: string;
    tags?: string[];
    minSignificance?: number;
    timeRange?: { start: string; end: string };
    limit?: number;
  }): Episode[] {
    let results = Array.from(this.episodes.values());

    if (query.text) {
      const terms = query.text.toLowerCase().split(/\s+/);
      results = results.filter((ep) => {
        const searchable = `${ep.title} ${ep.description} ${ep.events.map((e) => e.description).join(" ")}`.toLowerCase();
        return terms.some((term) => searchable.includes(term));
      });
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter((ep) =>
        query.tags!.some((tag) => ep.tags.includes(tag))
      );
    }

    if (query.minSignificance !== undefined) {
      results = results.filter((ep) => ep.significance >= query.minSignificance!);
    }

    if (query.timeRange) {
      const startMs = new Date(query.timeRange.start).getTime();
      const endMs = new Date(query.timeRange.end).getTime();
      results = results.filter((ep) => {
        const epStart = new Date(ep.startTime).getTime();
        const epEnd = new Date(ep.endTime).getTime();
        return epStart >= startMs && epEnd <= endMs;
      });
    }

    results.sort((a, b) => b.significance - a.significance);

    if (query.limit !== undefined) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  summarize(id: string): string {
    const episode = this.episodes.get(id);
    if (!episode) {
      throw new Error(`Episode not found: ${id}`);
    }

    const parts: string[] = [];
    parts.push(`Episode: ${episode.title}`);
    parts.push(`Duration: ${episode.startTime} to ${episode.endTime}`);
    parts.push(`Significance: ${episode.significance.toFixed(2)}`);

    if (episode.events.length > 0) {
      parts.push("Events:");
      for (const event of episode.events) {
        parts.push(`  - [${event.timestamp}] ${event.description} (outcome: ${event.outcome})`);
      }
    }

    if (episode.lessonsLearned.length > 0) {
      parts.push("Lessons learned:");
      for (const lesson of episode.lessonsLearned) {
        parts.push(`  - ${lesson}`);
      }
    }

    if (episode.emotionalValence !== 0) {
      const sentiment = episode.emotionalValence > 0 ? "positive" : "negative";
      parts.push(`Emotional tone: ${sentiment} (${Math.abs(episode.emotionalValence).toFixed(2)})`);
    }

    return parts.join("\n");
  }

  extractLessons(episode: Episode): Lesson[] {
    const lessons: Lesson[] = [];

    if (episode.lessonsLearned.length > 0) {
      for (const lessonText of episode.lessonsLearned) {
        lessons.push({
          id: generateId(),
          description: lessonText,
          context: episode.title,
          applicability: episode.significance,
          sourceEpisodeId: episode.id,
          createdAt: new Date().toISOString(),
        });
      }
    }

    for (const event of episode.events) {
      if (Math.abs(event.emotionalImpact) > 0.5) {
        const sentiment = event.emotionalImpact > 0 ? "positive" : "negative";
        lessons.push({
          id: generateId(),
          description: `${sentiment} outcome from "${event.description}": ${event.outcome}`,
          context: episode.title,
          applicability: Math.abs(event.emotionalImpact) * episode.significance,
          sourceEpisodeId: episode.id,
          createdAt: new Date().toISOString(),
        });
      }
    }

    const significantEvents = episode.events.filter((e) => e.emotionalImpact > 0.3);
    if (significantEvents.length >= 2) {
      const pattern = significantEvents
        .map((e) => e.outcome)
        .join(" followed by ");
      lessons.push({
        id: generateId(),
        description: `Recurring pattern observed: ${pattern}`,
        context: episode.title,
        applicability: 0.5 * episode.significance,
        sourceEpisodeId: episode.id,
        createdAt: new Date().toISOString(),
      });
    }

    return lessons;
  }

  getTemporalIndex(): TemporalIndex {
    return this.temporalIndex;
  }

  getEpisode(id: string): Episode | undefined {
    return this.episodes.get(id);
  }

  getLessons(episodeId?: string): Lesson[] {
    if (episodeId) {
      return Array.from(this.lessonStore.values()).filter(
        (l) => l.sourceEpisodeId === episodeId
      );
    }
    return Array.from(this.lessonStore.values());
  }

  addEvent(episodeId: string, event: EpisodicEvent): void {
    const episode = this.episodes.get(episodeId);
    if (!episode) {
      throw new Error(`Episode not found: ${episodeId}`);
    }

    episode.events.push(event);
    episode.updatedAt = new Date().toISOString();

    if (new Date(event.timestamp).getTime() > new Date(episode.endTime).getTime()) {
      episode.endTime = event.timestamp;
    }
  }

  relateEpisodes(id1: string, id2: string): void {
    const ep1 = this.episodes.get(id1);
    const ep2 = this.episodes.get(id2);
    if (!ep1 || !ep2) return;

    if (!ep1.relatedEpisodes.includes(id2)) {
      ep1.relatedEpisodes.push(id2);
    }
    if (!ep2.relatedEpisodes.includes(id1)) {
      ep2.relatedEpisodes.push(id1);
    }
  }

  delete(id: string): boolean {
    const deleted = this.episodes.delete(id);
    if (deleted) {
      for (const [lessonId, lesson] of this.lessonStore) {
        if (lesson.sourceEpisodeId === id) {
          this.lessonStore.delete(lessonId);
        }
      }
      this.emit("memory:deleted", { entryId: id, tier: "episodic" as const });
    }
    return deleted;
  }

  size(): number {
    return this.episodes.size;
  }

  lessonCount(): number {
    return this.lessonStore.size;
  }

  clear(): void {
    this.episodes.clear();
    this.lessonStore.clear();
    this.temporalIndex.byHour.clear();
    this.temporalIndex.byDay.clear();
    this.temporalIndex.byMonth.clear();
    this.temporalIndex.byYear.clear();
  }

  private updateTemporalIndex(id: string, timestamp: string): void {
    const date = new Date(timestamp);
    const hour = date.getHours();
    const day = date.toISOString().split("T")[0];
    const month = day.substring(0, 7);
    const year = date.getFullYear();

    if (!this.temporalIndex.byHour.has(hour)) {
      this.temporalIndex.byHour.set(hour, new Set());
    }
    this.temporalIndex.byHour.get(hour)!.add(id);

    if (!this.temporalIndex.byDay.has(day)) {
      this.temporalIndex.byDay.set(day, new Set());
    }
    this.temporalIndex.byDay.get(day)!.add(id);

    if (!this.temporalIndex.byMonth.has(month)) {
      this.temporalIndex.byMonth.set(month, new Set());
    }
    this.temporalIndex.byMonth.get(month)!.add(id);

    if (!this.temporalIndex.byYear.has(year)) {
      this.temporalIndex.byYear.set(year, new Set());
    }
    this.temporalIndex.byYear.get(year)!.add(id);
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
