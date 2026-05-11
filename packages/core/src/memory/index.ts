export { WorkingMemory } from "./working-memory.js";
export { ShortTermMemory } from "./short-term-memory.js";
export { LongTermMemory } from "./long-term-memory.js";
export { EpisodicMemory } from "./episodic-memory.js";
export { SemanticMemory } from "./semantic-memory.js";
export { MemoryIndexer } from "./memory-indexer.js";
export { MemoryCompressor } from "./memory-compressor.js";
export { MemoryConsolidator } from "./memory-consolidator.js";
export { ContextWindowOptimizer } from "./context-window-optimizer.js";
export { MemoryPersistence } from "./memory-persistence.js";
export { MemoryQuery } from "./memory-query.js";
export { MemoryManager } from "./memory-manager.js";

export {
  VectorStoreAdapter,
  BaseVectorStoreAdapter,
} from "./vector-store/vector-store-adapter.js";
export {
  InMemoryVectorStore,
} from "./vector-store/memory-vector-store.js";
export {
  SQLiteVectorStore,
} from "./vector-store/sqlite-vector-store.js";
export {
  cosineSimilarity,
  euclideanDistance,
  normalize,
  dotProduct,
  dimensionReduction,
} from "./vector-store/vector-utils.js";

export {
  GraphStoreAdapter,
  BaseGraphStoreAdapter,
} from "./graph-store/graph-store-adapter.js";
export {
  SQLiteGraphStore,
} from "./graph-store/sqlite-graph-store.js";

export type {
  MemoryStore,
  WorkingMemoryEntry,
  MemoryIndex,
  MemoryStoreMetadata,
  MemoryCompressionConfig,
  ConsolidationRule,
  ConsolidationCondition,
  ConsolidationAction,
  MemoryEvents,
  MemoryEventName,
  VectorEntry,
  MemoryGraphNode,
  MemoryGraphEdge,
  Episode,
  Lesson,
  TemporalIndex,
  SemanticEntry,
  SemanticRelation,
  Concept,
  MemoryRelation,
  Cluster,
  CompressedMemory,
  KeyPoint,
  QualityMetrics,
  FacetResult,
  OptimizedContext,
  RankedEntry,
  RankedResult,
  PaginatedResult,
  VectorSearchResult,
  VectorStoreStats,
  MemoryManagerConfig,
  EvictionPolicy,
  MemoryQueryInternal,
} from "./types.js";

export { DEFAULT_MEMORY_MANAGER_CONFIG } from "./types.js";
