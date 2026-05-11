import type {
  MemoryEntry,
  MemoryType,
  MemorySearchResult,
  MemoryQuery as SharedMemoryQuery,
  MemoryId,
  MemoryFact,
  MemoryRelationship,
  EpisodicEvent,
  SemanticConcept,
  SemanticHierarchy,
  SemanticAssociation,
} from "@paracosm/shared";
import type { Result } from "@paracosm/shared";

export type { MemoryEntry, MemoryType, MemorySearchResult, MemoryId, Result };
export type { MemoryFact, MemoryRelationship, EpisodicEvent };
export type { SemanticConcept, SemanticHierarchy, SemanticAssociation };

export interface MemoryStore {
  working: Map<string, WorkingMemoryEntry>;
  shortTerm: Map<string, MemoryEntry>;
  longTerm: Map<string, MemoryEntry>;
  episodic: Map<string, Episode>;
  semantic: Map<string, SemanticEntry>;
  indices: MemoryIndex;
  metadata: MemoryStoreMetadata;
}

export interface WorkingMemoryEntry {
  key: string;
  value: unknown;
  priority: number;
  accessCount: number;
  lastAccessedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryIndex {
  inverted: Map<string, Set<string>>;
  vector: Map<string, number[]>;
  temporal: Map<string, string>;
  facet: Map<string, Map<string, Set<string>>>;
  tagIndex: Map<string, Set<string>>;
  typeIndex: Map<string, Set<string>>;
}

export interface MemoryStoreMetadata {
  version: number;
  createdAt: string;
  updatedAt: string;
  entryCount: number;
  totalSizeBytes: number;
  lastConsolidatedAt: string | null;
  lastCompactedAt: string | null;
}

export interface MemoryCompressionConfig {
  enabled: boolean;
  algorithm: "lossy" | "lossless" | "hybrid";
  qualityThreshold: number;
  maxCompressionRatio: number;
  minEntriesToCompress: number;
  compressionIntervalMs: number;
  targetReductionPercent: number;
}

export interface ConsolidationRule {
  id: string;
  name: string;
  description: string;
  sourceTier: MemoryType;
  targetTier: MemoryType;
  conditions: ConsolidationCondition[];
  action: ConsolidationAction;
  priority: number;
  enabled: boolean;
}

export interface ConsolidationCondition {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
  value: unknown;
}

export interface ConsolidationAction {
  type: "promote" | "demote" | "archive" | "merge" | "delete";
  params: Record<string, unknown>;
}

export interface MemoryEvents {
  "memory:stored": { entryId: string; tier: MemoryType };
  "memory:retrieved": { entryId: string; tier: MemoryType };
  "memory:deleted": { entryId: string; tier: MemoryType };
  "memory:expired": { entryId: string; tier: MemoryType };
  "memory:consolidated": { entryId: string; from: MemoryType; to: MemoryType };
  "memory:compressed": { originalCount: number; compressedCount: number };
  "memory:evicted": { entryId: string; reason: string };
  "memory:indexed": { entryId: string };
  "memory:reinforced": { entryId: string; newImportance: number };
  "memory:decayed": { entryId: string; newImportance: number };
  "memory:associated": { sourceId: string; targetId: string; strength: number };
}

export type MemoryEventName = keyof MemoryEvents;

export interface VectorEntry {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryGraphNode {
  id: string;
  type: string;
  properties: Record<string, unknown>;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MemoryGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  properties: Record<string, unknown>;
  weight: number;
  createdAt: string;
}

export interface Episode {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  events: EpisodicEvent[];
  emotionalValence: number;
  significance: number;
  lessonsLearned: string[];
  relatedEpisodes: string[];
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Lesson {
  id: string;
  description: string;
  context: string;
  applicability: number;
  sourceEpisodeId: string;
  createdAt: string;
}

export interface TemporalIndex {
  byHour: Map<number, Set<string>>;
  byDay: Map<string, Set<string>>;
  byMonth: Map<string, Set<string>>;
  byYear: Map<number, Set<string>>;
}

export interface SemanticEntry {
  id: string;
  text: string;
  embedding: number[];
  concepts: Concept[];
  relations: SemanticRelation[];
  cluster: number;
  createdAt: string;
  updatedAt: string;
}

export interface SemanticRelation {
  source: string;
  target: string;
  type: string;
  strength: number;
}

export interface Cluster {
  id: number;
  centroid: number[];
  memberIds: string[];
  label: string;
  coherence: number;
}

export interface Concept {
  id: string;
  name: string;
  definition: string;
  frequency: number;
  relatedConcepts: string[];
  attributes: Record<string, unknown>;
  examples: string[];
}

export interface MemoryRelation {
  source: string;
  target: string;
  type: string;
  strength: number;
  bidirectional: boolean;
}

export interface CompressedMemory {
  id: string;
  originalIds: string[];
  summary: string;
  keyPoints: KeyPoint[];
  compressionRatio: number;
  createdAt: string;
}

export interface KeyPoint {
  id: string;
  text: string;
  importance: number;
  sourceIds: string[];
  category: string;
}

export interface QualityMetrics {
  informationRetention: number;
  compressionRatio: number;
  semanticSimilarity: number;
  keyPointCoverage: number;
  fidelityScore: number;
}

export interface FacetResult {
  facets: Record<string, Record<string, number>>;
  totalMatches: number;
}

export interface OptimizedContext {
  entries: MemoryEntry[];
  totalTokens: number;
  maxTokens: number;
  utilizationRatio: number;
  prunedCount: number;
  compressedCount: number;
  strategy: string;
}

export interface RankedEntry {
  entry: MemoryEntry;
  score: number;
  reasons: string[];
}

export interface RankedResult {
  entry: MemoryEntry;
  score: number;
  matchReason: string;
}

export interface PaginatedResult {
  entries: MemoryEntry[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  vector: number[];
  metadata: Record<string, unknown>;
}

export interface VectorStoreStats {
  vectorCount: number;
  dimension: number;
  indexSize: number;
  memoryUsageBytes: number;
  lastUpdated: string;
}

export interface MemoryManagerConfig {
  workingMemoryCapacity: number;
  shortTermTtlMs: number;
  shortTermMaxEntries: number;
  longTermMaxEntries: number;
  consolidationIntervalMs: number;
  decayRate: number;
  reinforcementBoost: number;
  compressionConfig: MemoryCompressionConfig;
  persistenceEnabled: boolean;
  persistencePath: string;
  vectorStoreDimension: number;
  contextWindowMaxTokens: number;
}

export const DEFAULT_MEMORY_MANAGER_CONFIG: MemoryManagerConfig = {
  workingMemoryCapacity: 100,
  shortTermTtlMs: 3600000,
  shortTermMaxEntries: 1000,
  longTermMaxEntries: 100000,
  consolidationIntervalMs: 60000,
  decayRate: 0.01,
  reinforcementBoost: 0.1,
  compressionConfig: {
    enabled: true,
    algorithm: "hybrid",
    qualityThreshold: 0.8,
    maxCompressionRatio: 0.3,
    minEntriesToCompress: 5,
    compressionIntervalMs: 300000,
    targetReductionPercent: 40,
  },
  persistenceEnabled: false,
  persistencePath: "./data/memory",
  vectorStoreDimension: 128,
  contextWindowMaxTokens: 8000,
};

export type EvictionPolicy = "lru" | "lfu";

export interface MemoryQueryInternal {
  text: string;
  types: MemoryType[];
  tags: string[];
  timeRange: { start: string; end: string } | null;
  minImportance: number;
  limit: number;
  offset: number;
  sortBy: string;
  sortOrder: "ascending" | "descending";
  filters: Array<{
    field: string;
    operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
    value: unknown;
  }>;
}
