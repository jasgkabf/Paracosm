import type { MemoryEntry, MemoryType, MemorySearchResult } from "@paracosm/shared";
import { Result, ok, err } from "@paracosm/shared";
import type {
  MemoryManagerConfig,
  MemoryEvents,
  MemoryEventName,
  MemoryStore,
  MemoryStoreMetadata,
  Episode,
} from "./types.js";
import { DEFAULT_MEMORY_MANAGER_CONFIG } from "./types.js";
import { WorkingMemory } from "./working-memory.js";
import { ShortTermMemory } from "./short-term-memory.js";
import { LongTermMemory } from "./long-term-memory.js";
import { EpisodicMemory } from "./episodic-memory.js";
import { SemanticMemory } from "./semantic-memory.js";
import { MemoryIndexer } from "./memory-indexer.js";
import { MemoryCompressor } from "./memory-compressor.js";
import { MemoryConsolidator } from "./memory-consolidator.js";
import { ContextWindowOptimizer } from "./context-window-optimizer.js";
import { MemoryPersistence } from "./memory-persistence.js";
import { MemoryQuery } from "./memory-query.js";
import { InMemoryVectorStore } from "./vector-store/memory-vector-store.js";
import { SQLiteGraphStore } from "./graph-store/sqlite-graph-store.js";

type EventHandler = (data: unknown) => void;

export class MemoryManager {
  private config: MemoryManagerConfig;
  private workingMemory: WorkingMemory;
  private shortTermMemory: ShortTermMemory;
  private longTermMemory: LongTermMemory;
  private episodicMemory: EpisodicMemory;
  private semanticMemory: SemanticMemory;
  private indexer: MemoryIndexer;
  private compressor: MemoryCompressor;
  private consolidator: MemoryConsolidator;
  private contextOptimizer: ContextWindowOptimizer;
  private persistence: MemoryPersistence;
  private queryEngine: MemoryQuery;
  private vectorStore: InMemoryVectorStore;
  private graphStore: SQLiteGraphStore;
  private listeners: Map<string, Set<EventHandler>>;
  private initialized: boolean;
  private consolidationTimer: ReturnType<typeof setInterval> | null;
  private decayTimer: ReturnType<typeof setInterval> | null;

  constructor(config?: Partial<MemoryManagerConfig>) {
    this.config = { ...DEFAULT_MEMORY_MANAGER_CONFIG, ...config };
    this.workingMemory = new WorkingMemory(this.config.workingMemoryCapacity);
    this.shortTermMemory = new ShortTermMemory(this.config.shortTermMaxEntries, this.config.shortTermTtlMs);
    this.longTermMemory = new LongTermMemory(this.config.longTermMaxEntries, this.config.decayRate);
    this.episodicMemory = new EpisodicMemory();
    this.semanticMemory = new SemanticMemory(this.config.vectorStoreDimension);
    this.indexer = new MemoryIndexer(this.config.vectorStoreDimension);
    this.compressor = new MemoryCompressor();
    this.consolidator = new MemoryConsolidator();
    this.contextOptimizer = new ContextWindowOptimizer(this.config.contextWindowMaxTokens, this.config.vectorStoreDimension);
    this.persistence = new MemoryPersistence(this.config.persistencePath);
    this.queryEngine = new MemoryQuery();
    this.vectorStore = new InMemoryVectorStore(this.config.vectorStoreDimension);
    this.graphStore = new SQLiteGraphStore();
    this.listeners = new Map();
    this.initialized = false;
    this.consolidationTimer = null;
    this.decayTimer = null;

    this.consolidator.setShortTermStore(new Map());
    this.consolidator.setLongTermStore(new Map());
  }

  init(config?: Partial<MemoryManagerConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.workingMemory = new WorkingMemory(this.config.workingMemoryCapacity);
    this.shortTermMemory = new ShortTermMemory(this.config.shortTermMaxEntries, this.config.shortTermTtlMs);
    this.longTermMemory = new LongTermMemory(this.config.longTermMaxEntries, this.config.decayRate);
    this.contextOptimizer = new ContextWindowOptimizer(this.config.contextWindowMaxTokens, this.config.vectorStoreDimension);

    this.consolidator.setShortTermStore(new Map());
    this.consolidator.setLongTermStore(new Map());

    if (this.config.persistenceEnabled) {
      this.persistence.startAutoSave(
        () => this.getStore(),
        "memory-store.json"
      );
    }

    if (this.config.consolidationIntervalMs > 0) {
      this.consolidationTimer = setInterval(() => {
        this.consolidate();
      }, this.config.consolidationIntervalMs);
    }

    this.decayTimer = setInterval(() => {
      this.longTermMemory.decay();
    }, 86400000);

    this.initialized = true;
    this.emit("memory:stored", { entryId: "system", tier: "working" as MemoryType });
  }

  shutdown(): void {
    if (this.consolidationTimer !== null) {
      clearInterval(this.consolidationTimer);
      this.consolidationTimer = null;
    }

    if (this.decayTimer !== null) {
      clearInterval(this.decayTimer);
      this.decayTimer = null;
    }

    this.persistence.stopAutoSave();

    if (this.config.persistenceEnabled) {
      this.persistence.save(this.getStore(), "memory-store.json");
    }

    this.initialized = false;
  }

  store(entry: Partial<MemoryEntry> & { content: string }, tier?: MemoryType): void {
    const targetTier = tier ?? entry.type ?? ("conversation" as MemoryType);

    switch (targetTier) {
      case "working" as MemoryType:
        this.workingMemory.set(entry.id ?? `wm_${Date.now()}`, entry.content, entry.importance);
        break;

      case "conversation" as MemoryType:
        this.shortTermMemory.add(entry);
        if (entry.id) {
          const stored = this.shortTermMemory.get(entry.id);
          if (stored) {
            this.indexer.index(stored);
          }
        }
        break;

      case "long_term" as MemoryType:
        this.longTermMemory.store(entry);
        if (entry.id) {
          const stored = this.longTermMemory.retrieve(entry.id);
          if (stored) {
            this.indexer.index(stored);
          }
        }
        break;

      case "episodic" as MemoryType:
        this.episodicMemory.record({
          title: entry.metadata?.title as string ?? entry.content.substring(0, 50),
          description: entry.content,
          significance: entry.importance,
          tags: entry.tags,
        });
        break;

      case "semantic" as MemoryType:
        const embedding = entry.embedding ?? this.semanticMemory.embed(entry.content);
        const memoryEntry: MemoryEntry = {
          id: entry.id ?? `sem_${Date.now()}`,
          type: "semantic" as MemoryType,
          content: entry.content,
          embedding,
          importance: entry.importance ?? 0.5,
          accessCount: 0,
          lastAccessedAt: new Date().toISOString(),
          expiresAt: null,
          tags: entry.tags ?? [],
          source: entry.source ?? "semantic",
          metadata: entry.metadata ?? {},
          createdAt: entry.createdAt ?? new Date().toISOString(),
          updatedAt: entry.updatedAt ?? new Date().toISOString(),
        };
        this.semanticMemory.index(memoryEntry, embedding);
        if (embedding.length > 0) {
          this.vectorStore.upsert(memoryEntry.id, embedding, { content: entry.content });
        }
        break;
    }

    this.emit("memory:stored", { entryId: entry.id ?? "unknown", tier: targetTier });
  }

  retrieve(id: string): MemoryEntry | null {
    const workingEntry = this.workingMemory.getEntry(id);
    if (workingEntry) {
      return {
        id: workingEntry.key,
        type: "working" as MemoryType,
        content: String(workingEntry.value),
        embedding: null,
        importance: workingEntry.priority,
        accessCount: workingEntry.accessCount,
        lastAccessedAt: workingEntry.lastAccessedAt,
        expiresAt: null,
        tags: [],
        source: "working",
        metadata: {},
        createdAt: workingEntry.createdAt,
        updatedAt: workingEntry.updatedAt,
      };
    }

    const stmEntry = this.shortTermMemory.get(id);
    if (stmEntry) {
      this.emit("memory:retrieved", { entryId: id, tier: "conversation" as MemoryType });
      return stmEntry;
    }

    const ltmEntry = this.longTermMemory.retrieve(id);
    if (ltmEntry) {
      return ltmEntry;
    }

    const episode = this.episodicMemory.getEpisode(id);
    if (episode) {
      return {
        id: episode.id,
        type: "episodic" as MemoryType,
        content: episode.description,
        embedding: null,
        importance: episode.significance,
        accessCount: 0,
        lastAccessedAt: episode.updatedAt,
        expiresAt: null,
        tags: episode.tags,
        source: "episodic",
        metadata: { title: episode.title, events: episode.events.length },
        createdAt: episode.createdAt,
        updatedAt: episode.updatedAt,
      };
    }

    return null;
  }

  search(query: {
    text?: string;
    tags?: string[];
    type?: MemoryType;
    minImportance?: number;
    limit?: number;
  }): MemorySearchResult[] {
    const results: MemorySearchResult[] = [];

    if (!query.type || query.type === ("long_term" as MemoryType)) {
      const ltmResults = this.longTermMemory.search(query);
      results.push(...ltmResults);
    }

    if (!query.type || query.type === ("semantic" as MemoryType)) {
      if (query.text) {
        const semanticResults = this.semanticMemory.search(query.text, query.limit ?? 10);
        results.push(...semanticResults);
      }
    }

    if (!query.type || query.type === ("conversation" as MemoryType)) {
      const stmEntries = this.shortTermMemory.query(query);
      for (const entry of stmEntries) {
        results.push({
          entry,
          score: entry.importance,
          highlights: [],
          matchReason: "short-term match",
        });
      }
    }

    if (query.text) {
      const indexerResults = this.indexer.search(query);
      for (const entry of indexerResults) {
        const alreadyExists = results.some((r) => r.entry.id === entry.id);
        if (!alreadyExists) {
          results.push({
            entry,
            score: entry.importance,
            highlights: [],
            matchReason: "index match",
          });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);

    if (query.limit !== undefined) {
      return results.slice(0, query.limit);
    }

    return results;
  }

  forget(id: string): void {
    this.workingMemory.delete(id);
    this.shortTermMemory.delete(id);
    this.longTermMemory.delete(id);
    this.episodicMemory.delete(id);
    this.semanticMemory.delete(id);
    this.indexer.remove(id);
    this.vectorStore.delete(id);

    this.emit("memory:deleted", { entryId: id, tier: "working" as MemoryType });
  }

  consolidate(): void {
    this.shortTermMemory.expire();
    this.longTermMemory.decay();

    this.consolidator.setShortTermStore(this.getShortTermStoreMap());
    this.consolidator.setLongTermStore(this.getLongTermStoreMap());
    this.consolidator.consolidate();

    if (this.config.compressionConfig.enabled) {
      this.shortTermMemory.compress();
    }
  }

  optimize(): void {
    this.shortTermMemory.expire();
    this.longTermMemory.decay();
    this.indexer.reindex();
    this.semanticMemory.deduplicate();
  }

  getWorkingMemory(): WorkingMemory {
    return this.workingMemory;
  }

  getShortTermMemory(): ShortTermMemory {
    return this.shortTermMemory;
  }

  getLongTermMemory(): LongTermMemory {
    return this.longTermMemory;
  }

  getEpisodicMemory(): EpisodicMemory {
    return this.episodicMemory;
  }

  getSemanticMemory(): SemanticMemory {
    return this.semanticMemory;
  }

  getIndexer(): MemoryIndexer {
    return this.indexer;
  }

  getCompressor(): MemoryCompressor {
    return this.compressor;
  }

  getConsolidator(): MemoryConsolidator {
    return this.consolidator;
  }

  getContextOptimizer(): ContextWindowOptimizer {
    return this.contextOptimizer;
  }

  getPersistence(): MemoryPersistence {
    return this.persistence;
  }

  getQueryEngine(): MemoryQuery {
    return this.queryEngine;
  }

  getVectorStore(): InMemoryVectorStore {
    return this.vectorStore;
  }

  getGraphStore(): SQLiteGraphStore {
    return this.graphStore;
  }

  getConfig(): MemoryManagerConfig {
    return { ...this.config };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getStore(): MemoryStore {
    const workingMap = new Map<string, any>();
    for (const entry of this.workingMemory.entries()) {
      workingMap.set(entry.key, entry);
    }

    return {
      working: workingMap,
      shortTerm: this.getShortTermStoreMap(),
      longTerm: this.getLongTermStoreMap(),
      episodic: new Map(),
      semantic: new Map(),
      indices: {
        inverted: new Map(),
        vector: new Map(),
        temporal: new Map(),
        facet: new Map(),
        tagIndex: new Map(),
        typeIndex: new Map(),
      },
      metadata: {
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        entryCount: this.getTotalEntryCount(),
        totalSizeBytes: 0,
        lastConsolidatedAt: null,
        lastCompactedAt: null,
      },
    };
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

  private getShortTermStoreMap(): Map<string, MemoryEntry> {
    const map = new Map<string, MemoryEntry>();
    for (const entry of this.shortTermMemory.all()) {
      map.set(entry.id, entry);
    }
    return map;
  }

  private getLongTermStoreMap(): Map<string, MemoryEntry> {
    const map = new Map<string, MemoryEntry>();
    for (const entry of this.longTermMemory.all()) {
      map.set(entry.id, entry);
    }
    return map;
  }

  private getTotalEntryCount(): number {
    return (
      this.workingMemory.size() +
      this.shortTermMemory.size() +
      this.longTermMemory.size() +
      this.episodicMemory.size() +
      this.semanticMemory.size()
    );
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
}
