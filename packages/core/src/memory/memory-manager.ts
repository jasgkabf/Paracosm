import type { MemoryEntry, MemoryType, MemoryQuery as MemQuery } from '@paracosm/shared';
import { ok, err, type Result, createLogger } from '@paracosm/shared';
import { WorkingMemory } from './working-memory.js';
import { ShortTermMemory } from './short-term-memory.js';
import { LongTermMemory } from './long-term-memory.js';
import { EpisodicMemory } from './episodic-memory.js';
import { SemanticMemory } from './semantic-memory.js';
import { MemoryIndexer } from './memory-indexer.js';
import { MemoryCompressor } from './memory-compressor.js';
import { MemoryConsolidator } from './memory-consolidator.js';
import { ContextWindowOptimizer } from './context-window-optimizer.js';
import { MemoryPersistence } from './memory-persistence.js';
import { MemoryQuery } from './memory-query.js';
import { MemoryVectorStore } from './vector-store/memory-vector-store.js';
import { SqliteGraphStore } from './graph-store/sqlite-graph-store.js';
import type { MemoryConfig, ContextWindow, ConsolidationPlan } from './types.js';
import { DEFAULT_MEMORY_CONFIG } from './types.js';

const logger = createLogger('MemoryManager');

export class MemoryManager {
  private config: MemoryConfig;
  private working: WorkingMemory;
  private shortTerm: ShortTermMemory;
  private longTerm: LongTermMemory;
  private episodic: EpisodicMemory;
  private semantic: SemanticMemory;
  private indexer: MemoryIndexer;
  private compressor: MemoryCompressor;
  private consolidator: MemoryConsolidator;
  private contextOptimizer: ContextWindowOptimizer;
  private persistence: MemoryPersistence;
  private query: MemoryQuery;
  private vectorStore: MemoryVectorStore;
  private graphStore: SqliteGraphStore;
  private listeners: Map<string, Array<(data: unknown) => void>> = new Map();

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.working = new WorkingMemory(this.config.workingMemoryCapacity);
    this.shortTerm = new ShortTermMemory(this.config.shortTermCapacity);
    this.longTerm = new LongTermMemory(this.config.longTermCapacity);
    this.episodic = new EpisodicMemory();
    this.semantic = new SemanticMemory();
    this.indexer = new MemoryIndexer();
    this.compressor = new MemoryCompressor();
    this.consolidator = new MemoryConsolidator(this.config.consolidationThreshold);
    this.contextOptimizer = new ContextWindowOptimizer();
    this.persistence = new MemoryPersistence();
    this.query = new MemoryQuery(this.indexer);
    this.vectorStore = new MemoryVectorStore(this.config.vectorDimensions);
    this.graphStore = new SqliteGraphStore();
  }

  on(event: string, listener: (data: unknown) => void): () => void {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
    return () => {
      const list = this.listeners.get(event);
      if (list) {
        const idx = list.indexOf(listener);
        if (idx !== -1) list.splice(idx, 1);
      }
    };
  }

  private emitEvent(event: string, data: unknown): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) { try { listener(data); } catch (error) { logger.error(`Event listener error: ${error}`); } }
    }
  }

  store(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'accessCount'> & { id?: string }): Result<MemoryEntry> {
    let result: Result<MemoryEntry>;
    switch (entry.type) {
      case 'working':
        result = this.working.store(entry);
        break;
      case 'long_term':
        result = this.longTerm.store(entry);
        break;
      case 'episodic':
        result = this.shortTerm.store(entry);
        break;
      case 'semantic':
        result = this.longTerm.store(entry);
        break;
      default:
        result = this.shortTerm.store(entry);
    }
    if (result.ok) {
      this.indexer.index(result.value);
      this.emitEvent('memory:stored', result.value);
    }
    return result;
  }

  retrieve(id: string): MemoryEntry | undefined {
    let entry = this.working.retrieve(id);
    if (entry) return entry;
    entry = this.shortTerm.retrieve(id);
    if (entry) return entry;
    entry = this.longTerm.retrieve(id);
    return entry;
  }

  remove(id: string): Result<boolean> {
    let result = this.working.remove(id);
    if (result.ok) return result;
    result = this.shortTerm.remove(id);
    if (result.ok) return result;
    return this.longTerm.remove(id);
  }

  search(query: string, options?: { type?: MemoryType; minImportance?: number; limit?: number }): MemoryEntry[] {
    const allEntries = this.getAllEntries();
    return this.query.search(allEntries, query, options);
  }

  consolidate(): ConsolidationPlan[] {
    const allEntries = this.getAllEntries();
    return this.consolidator.evaluateForConsolidation(allEntries);
  }

  executeConsolidation(plans: ConsolidationPlan[]): number {
    let executed = 0;
    for (const plan of plans) {
      switch (plan.strategy) {
        case 'promote': {
          for (const entryId of plan.entriesToConsolidate) {
            const entry = this.retrieve(entryId);
            if (entry) {
              this.remove(entryId);
              const promoted = { ...entry, type: plan.targetMemoryType };
              this.store(promoted);
              executed++;
            }
          }
          break;
        }
        case 'compress': {
          const entries = plan.entriesToConsolidate
            .map((id) => this.retrieve(id))
            .filter((e): e is MemoryEntry => e !== undefined);
          if (entries.length > 1) {
            const compressed = this.compressor.compress(entries);
            for (const entry of entries) {
              this.remove(entry.id);
            }
            this.store(compressed);
            executed++;
          }
          break;
        }
        case 'archive': {
          for (const entryId of plan.entriesToConsolidate) {
            this.remove(entryId);
            executed++;
          }
          break;
        }
        case 'demote': {
          for (const entryId of plan.entriesToConsolidate) {
            const entry = this.retrieve(entryId);
            if (entry) {
              this.remove(entryId);
              const demoted = { ...entry, type: plan.targetMemoryType, importance: (entry.importance ?? 0) * 0.5 };
              this.store(demoted);
              executed++;
            }
          }
          break;
        }
      }
    }
    return executed;
  }

  optimizeContext(priorities?: Map<string, number>): ContextWindow {
    const allEntries = this.getAllEntries();
    return this.contextOptimizer.optimize(allEntries, priorities);
  }

  async save(key: string): Promise<Result<boolean>> {
    return this.persistence.save(key, this.getAllEntries());
  }

  async load(key: string): Promise<Result<number>> {
    const result = await this.persistence.load(key);
    if (!result.ok) return err(result.err);
    this.clear();
    for (const entry of result.value) {
      this.store(entry);
    }
    return ok(result.value.length);
  }

  getWorkingMemory(): WorkingMemory { return this.working; }
  getShortTermMemory(): ShortTermMemory { return this.shortTerm; }
  getLongTermMemory(): LongTermMemory { return this.longTerm; }
  getEpisodicMemory(): EpisodicMemory { return this.episodic; }
  getSemanticMemory(): SemanticMemory { return this.semantic; }
  getVectorStore(): MemoryVectorStore { return this.vectorStore; }
  getGraphStore(): SqliteGraphStore { return this.graphStore; }

  private getAllEntries(): MemoryEntry[] {
    return [
      ...this.working.getAll(),
      ...this.shortTerm.getAll(),
      ...this.longTerm.getAll(),
    ];
  }

  getTotalEntryCount(): number {
    return this.working.getSize() + this.shortTerm.getSize() + this.longTerm.getSize();
  }

  clear(): void {
    this.working.clear();
    this.shortTerm.clear();
    this.longTerm.clear();
    this.episodic.clear();
    this.semantic.clear();
    this.indexer.clear();
    this.vectorStore.clear();
    this.graphStore.clear();
    this.emitEvent('memory:cleared', null);
  }
}
