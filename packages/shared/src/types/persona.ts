export type PersonaRole =
  | 'architect'
  | 'executor'
  | 'critic'
  | 'dreamer'
  | 'curator'
  | 'explorer'
  | 'optimizer'
  | 'synthesizer'
  | 'guardian'
  | 'innovator'
  | 'analyst';

export interface PersonaConfig {
  role: PersonaRole;
  name: string;
  description: string;
  systemPrompt: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  priority: number;
  activeByDefault: boolean;
  metadata: Record<string, unknown>;
}

export interface PersonaState {
  personaId: string;
  active: boolean;
  lastActivated: Date;
  invocationCount: number;
  successRate: number;
  averageLatencyMs: number;
  contextWindow: string[];
}

export interface Persona {
  id: string;
  config: PersonaConfig;
  state: PersonaState;
  createdAt: Date;
  updatedAt: Date;
}

export interface DebateRound {
  roundNumber: number;
  proposals: DebateProposal[];
  critiques: DebateCritique[];
  timestamp: Date;
}

export interface DebateProposal {
  personaId: string;
  content: string;
  confidence: number;
  reasoning: string;
  alternatives: string[];
  metadata: Record<string, unknown>;
}

export interface DebateCritique {
  personaId: string;
  targetProposalId: string;
  content: string;
  severity: number;
  suggestions: string[];
  metadata: Record<string, unknown>;
}

export interface DebateResult {
  id: string;
  topic: string;
  rounds: DebateRound[];
  winner?: string;
  consensus: string;
  confidence: number;
  duration: number;
  timestamp: Date;
}

export interface DebateVote {
  personaId: string;
  proposalId: string;
  score: number;
  reasoning: string;
  timestamp: Date;
}

export interface PersonaCombination {
  id: string;
  personaIds: string[];
  synergyScore: number;
  taskType: string;
  historicalPerformance: number;
  metadata: Record<string, unknown>;
}

export interface PersonaActivation {
  personaId: string;
  activatedAt: Date;
  deactivatedAt?: Date;
  trigger: string;
  context: string;
  result?: string;
  metadata: Record<string, unknown>;
}
