import type { MemoryEntry, MemoryType, MemoryQuery as MemQuery } from '@paracosm/shared';

export interface MemoryConfig {
  workingMemoryCapacity: number;
  shortTermCapacity: number;
  longTermCapacity: number;
  consolidationThreshold: number;
  compressionEnabled: boolean;
  persistenceEnabled: boolean;
  persistencePath?: string;
  vectorDimensions: number;
  similarityThreshold: number;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  score: number;
  highlights: string[];
}

export interface ConsolidationPlan {
  entriesToConsolidate: string[];
  targetMemoryType: MemoryType;
  strategy: 'promote' | 'demote' | 'archive' | 'compress';
  reason: string;
}

export interface ContextWindow {
  entries: MemoryEntry[];
  totalTokens: number;
  maxTokens: number;
  utilization: number;
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  workingMemoryCapacity: 10,
  shortTermCapacity: 100,
  longTermCapacity: 10000,
  consolidationThreshold: 0.7,
  compressionEnabled: true,
  persistenceEnabled: false,
  vectorDimensions: 128,
  similarityThreshold: 0.8,
};
