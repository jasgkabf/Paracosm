import type { PersonaRole, PersonaConfig, PersonaState, Persona, DebateResult, PersonaCombination, PersonaActivation, DebateProposal, DebateCritique, DebateVote } from '@paracosm/shared';

export interface MeshConfig {
  maxActivePersonas: number;
  debateEnabled: boolean;
  maxDebateRounds: number;
  consensusThreshold: number;
  autoActivation: boolean;
  learningEnabled: boolean;
  adaptationRate: number;
}

export interface PersonaResponse {
  personaId: string;
  content: string;
  confidence: number;
  reasoning: string;
  alternatives: string[];
  latencyMs: number;
  tokenUsage: { prompt: number; completion: number; total: number };
  metadata: Record<string, unknown>;
}

export interface MeshResponse {
  responses: PersonaResponse[];
  consensus: string;
  confidence: number;
  debateResult?: DebateResult;
  duration: number;
  metadata: Record<string, unknown>;
}

export interface PersonaPerformance {
  personaId: string;
  totalInvocations: number;
  successCount: number;
  failureCount: number;
  averageConfidence: number;
  averageLatencyMs: number;
  successRate: number;
  recentTrend: 'improving' | 'stable' | 'declining';
  lastInvokedAt: Date;
}

export interface ActivationCriteria {
  taskType: string;
  complexity: 'low' | 'medium' | 'high';
  requiredRoles: PersonaRole[];
  excludedRoles?: PersonaRole[];
  minConfidence?: number;
  contextKeywords?: string[];
}

export interface LearningDataPoint {
  personaId: string;
  taskId: string;
  taskType: string;
  success: boolean;
  confidence: number;
  latencyMs: number;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export const DEFAULT_MESH_CONFIG: MeshConfig = {
  maxActivePersonas: 5,
  debateEnabled: true,
  maxDebateRounds: 3,
  consensusThreshold: 0.75,
  autoActivation: true,
  learningEnabled: true,
  adaptationRate: 0.1,
};
