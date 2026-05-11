export type MemoryType = 'conversation' | 'working' | 'long_term' | 'episodic' | 'semantic';
export interface MemoryEntry {
    id: string;
    type: MemoryType;
    content: string;
    embedding?: number[];
    importance: number;
    accessCount: number;
    lastAccessedAt: Date;
    createdAt: Date;
    expiresAt?: Date;
    metadata: Record<string, unknown>;
}
export interface ConversationMemory {
    id: string;
    sessionId: string;
    entries: MemoryEntry[];
    summary: string;
    participantCount: number;
    messageCount: number;
    startedAt: Date;
    endedAt?: Date;
    metadata: Record<string, unknown>;
}
export interface WorkingMemory {
    id: string;
    capacity: number;
    entries: MemoryEntry[];
    currentLoad: number;
    evictionPolicy: 'lru' | 'lfu' | 'fifo';
    metadata: Record<string, unknown>;
}
export interface LongTermMemory {
    id: string;
    entries: MemoryEntry[];
    totalEntries: number;
    totalSize: number;
    indexType: string;
    lastConsolidatedAt: Date;
    metadata: Record<string, unknown>;
}
export interface EpisodicMemory {
    id: string;
    episode: string;
    entries: MemoryEntry[];
    startTime: Date;
    endTime: Date;
    emotionalValence: number;
    significance: number;
    metadata: Record<string, unknown>;
}
export interface SemanticMemory {
    id: string;
    concepts: Map<string, MemoryEntry>;
    relations: Map<string, string[]>;
    totalConcepts: number;
    totalRelations: number;
    lastUpdated: Date;
    metadata: Record<string, unknown>;
}
export interface MemoryQuery {
    type?: MemoryType;
    content?: string;
    embedding?: number[];
    similarityThreshold?: number;
    maxResults?: number;
    timeRange?: {
        start: Date;
        end: Date;
    };
    importanceThreshold?: number;
    filters?: Record<string, unknown>;
}
export interface MemorySearchResult {
    entry: MemoryEntry;
    score: number;
    highlights: string[];
    metadata: Record<string, unknown>;
}
//# sourceMappingURL=memory.d.ts.map