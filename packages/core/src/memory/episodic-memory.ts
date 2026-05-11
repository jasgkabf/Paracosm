import type { MemoryEntry } from '@paracosm/shared';
import { generateId, ok, type Result, createLogger } from '@paracosm/shared';

const logger = createLogger('EpisodicMemory');

export interface Episode {
  id: string;
  name: string;
  description: string;
  entries: MemoryEntry[];
  startTime: Date;
  endTime: Date;
  metadata: Record<string, unknown>;
}

export class EpisodicMemory {
  private episodes: Map<string, Episode> = new Map();
  private currentEpisodeId: string | null = null;

  startEpisode(name: string, description: string, metadata?: Record<string, unknown>): Episode {
    const episode: Episode = {
      id: generateId(),
      name,
      description,
      entries: [],
      startTime: new Date(),
      endTime: new Date(),
      metadata: metadata ?? {},
    };
    this.episodes.set(episode.id, episode);
    this.currentEpisodeId = episode.id;
    logger.info(`Started episode: ${name}`);
    return episode;
  }

  endEpisode(episodeId?: string): Result<Episode> {
    const id = episodeId ?? this.currentEpisodeId;
    if (!id) return ok(this.createEmptyEpisode());
    const episode = this.episodes.get(id);
    if (!episode) return ok(this.createEmptyEpisode());
    episode.endTime = new Date();
    if (this.currentEpisodeId === id) this.currentEpisodeId = null;
    logger.info(`Ended episode: ${episode.name}`);
    return ok(episode);
  }

  addEntry(entry: MemoryEntry, episodeId?: string): Result<boolean> {
    const id = episodeId ?? this.currentEpisodeId;
    if (!id) return ok(false);
    const episode = this.episodes.get(id);
    if (!episode) return ok(false);
    episode.entries.push(entry);
    return ok(true);
  }

  getEpisode(episodeId: string): Episode | undefined {
    return this.episodes.get(episodeId);
  }

  getCurrentEpisode(): Episode | null {
    if (!this.currentEpisodeId) return null;
    return this.episodes.get(this.currentEpisodeId) ?? null;
  }

  searchEpisodes(query: string): Episode[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.episodes.values()).filter(
      (e) => e.name.toLowerCase().includes(lowerQuery) || e.description.toLowerCase().includes(lowerQuery),
    );
  }

  getEpisodesInRange(start: Date, end: Date): Episode[] {
    return Array.from(this.episodes.values()).filter(
      (e) => e.startTime >= start && e.endTime <= end,
    );
  }

  getAllEpisodes(): Episode[] {
    return Array.from(this.episodes.values());
  }

  private createEmptyEpisode(): Episode {
    return { id: '', name: '', description: '', entries: [], startTime: new Date(), endTime: new Date(), metadata: {} };
  }

  clear(): void {
    this.episodes.clear();
    this.currentEpisodeId = null;
  }
}
