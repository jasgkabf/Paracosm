import type { Timestamped, Identified } from "./common.js";

export type MemoryId = string & { readonly __brand: unique symbol };

export enum MemoryType {
  Conversation = "conversation",
  Working = "working",
  LongTerm = "long_term",
  Episodic = "episodic",
  Semantic = "semantic",
}

export interface MemoryEntry extends Identified, Timestamped {
  type: MemoryType;
  content: string;
  embedding: number[] | null;
  importance: number;
  accessCount: number;
  lastAccessedAt: string;
  expiresAt: string | null;
  tags: string[];
  source: string;
  metadata: Record<string, unknown>;
}

export interface ConversationMemory extends Identified, Timestamped {
  sessionId: string;
  messages: ConversationMessage[];
  summary: string;
  participantIds: string[];
  topic: string;
  sentiment: number;
  keyDecisions: string[];
  actionItems: string[];
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface WorkingMemory extends Identified {
  context: string;
  items: WorkingMemoryItem[];
  capacity: number;
  currentLoad: number;
  lastUpdated: string;
}

export interface WorkingMemoryItem {
  id: string;
  content: string;
  priority: number;
  addedAt: string;
  expiresAt: string | null;
  source: string;
  relevanceScore: number;
}

export interface LongTermMemory extends Identified, Timestamped {
  category: string;
  facts: MemoryFact[];
  relationships: MemoryRelationship[];
  lastConsolidatedAt: string;
  consolidationCount: number;
}

export interface MemoryFact {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  source: string;
  establishedAt: string;
  lastVerifiedAt: string;
}

export interface MemoryRelationship {
  sourceId: string;
  targetId: string;
  relationType: string;
  strength: number;
  bidirectional: boolean;
}

export interface EpisodicMemory extends Identified, Timestamped {
  episodeStart: string;
  episodeEnd: string;
  events: EpisodicEvent[];
  emotionalValence: number;
  significance: number;
  lessonsLearned: string[];
  relatedEpisodes: MemoryId[];
}

export interface EpisodicEvent {
  id: string;
  timestamp: string;
  description: string;
  participants: string[];
  outcome: string;
  emotionalImpact: number;
}

export interface SemanticMemory extends Identified, Timestamped {
  concepts: SemanticConcept[];
  hierarchies: SemanticHierarchy[];
  associations: SemanticAssociation[];
  lastUpdated: string;
}

export interface SemanticConcept {
  id: string;
  name: string;
  definition: string;
  attributes: Record<string, unknown>;
  examples: string[];
}

export interface SemanticHierarchy {
  parentId: string;
  childId: string;
  relation: "is_a" | "part_of" | "instance_of";
}

export interface SemanticAssociation {
  conceptA: string;
  conceptB: string;
  strength: number;
  type: string;
}

export interface MemoryQuery {
  text: string;
  embedding: number[] | null;
  types: MemoryType[];
  tags: string[];
  timeRange: { start: string; end: string } | null;
  minImportance: number;
  limit: number;
  offset: number;
  includeEmbeddings: boolean;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  score: number;
  highlights: string[];
  matchReason: string;
}
