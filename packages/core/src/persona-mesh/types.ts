import type {
  PersonaId as SharedPersonaId,
  PersonaRole,
  PersonaTrait,
  PersonaBias,
  PersonaState,
  DebateOutcome,
  DebateVoteType,
} from "@paracosm/shared";
import type { Result } from "@paracosm/shared";

export type InternalPersonaId = string;

export interface PersonaInternal {
  id: InternalPersonaId;
  name: string;
  role: PersonaRole;
  description: string;
  systemPrompt: string;
  traits: PersonaTrait[];
  biases: PersonaBias[];
  expertise: string[];
  tools: string[];
  constraints: string[];
  communicationStyle: string;
  preferredTaskTypes: string[];
  weight: number;
  state: PersonaState;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface PersonaCreateConfig {
  id?: InternalPersonaId;
  name: string;
  role: PersonaRole;
  description: string;
  systemPrompt?: string;
  traits?: PersonaTrait[];
  biases?: PersonaBias[];
  expertise?: string[];
  tools?: string[];
  constraints?: string[];
  communicationStyle?: string;
  preferredTaskTypes?: string[];
  weight?: number;
}

export interface DebateContext {
  id: string;
  topic: string;
  personaIds: InternalPersonaId[];
  phase: DebatePhase;
  rounds: DebateRoundData[];
  currentRoundNumber: number;
  startTime: string;
  endTime: string | null;
  timeLimitMs: number | null;
  status: "pending" | "active" | "completed" | "failed" | "timed_out";
  sharedMemory: Map<string, unknown>;
}

export enum DebatePhase {
  Opening = "opening",
  Proposals = "proposals",
  Critiques = "critiques",
  Defenses = "defenses",
  Voting = "voting",
  Conclusion = "conclusion",
}

export interface DebateMessage {
  id: string;
  personaId: InternalPersonaId;
  type: "proposal" | "critique" | "defense" | "vote" | "meta";
  content: string;
  targetId: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface DebateRoundData {
  roundNumber: number;
  proposals: ProposalData[];
  critiques: CritiqueData[];
  defenses: DefenseData[];
  votes: VoteData[];
  summary: string | null;
}

export interface ProposalData {
  id: string;
  personaId: InternalPersonaId;
  content: string;
  confidence: number;
  supportingEvidence: string[];
  assumptions: string[];
  timestamp: string;
}

export interface CritiqueData {
  id: string;
  personaId: InternalPersonaId;
  proposalId: string;
  content: string;
  severity: "low" | "medium" | "high";
  addressedPoints: string[];
  counterEvidence: string[];
  timestamp: string;
}

export interface DefenseData {
  id: string;
  personaId: InternalPersonaId;
  proposalId: string;
  critiqueId: string;
  content: string;
  conceded: string[];
  rebutted: string[];
  timestamp: string;
}

export interface VoteData {
  personaId: InternalPersonaId;
  proposalId: string;
  score: number;
  reasoning: string;
  timestamp: string;
}

export interface PersonaPerformance {
  personaId: InternalPersonaId;
  debatesParticipated: number;
  proposalsMade: number;
  proposalsAccepted: number;
  critiquesMade: number;
  critiquesSustained: number;
  defensesMade: number;
  defensesSuccessful: number;
  averageScore: number;
  winRate: number;
  contributionScore: number;
  lastActiveAt: string | null;
  adaptationHistory: AdaptationEntry[];
}

export interface AdaptationEntry {
  timestamp: string;
  type: "prompt" | "weight" | "constraint" | "tool";
  description: string;
  before: string;
  after: string;
  outcome: "positive" | "negative" | "neutral";
}

export type CombinationStrategy = "minimal" | "balanced" | "comprehensive";

export interface PersonaMeshConfig {
  maxActivePersonas: number;
  defaultStrategy: CombinationStrategy;
  debateRounds: number;
  consensusThreshold: number;
  timeLimitMs: number;
  allowDissent: boolean;
  minParticipants: number;
  maxParticipants: number;
  enableLearning: boolean;
  enableHotReload: boolean;
  tokenBudget: number;
}

export const DEFAULT_PERSONA_MESH_CONFIG: PersonaMeshConfig = {
  maxActivePersonas: 5,
  defaultStrategy: "balanced",
  debateRounds: 3,
  consensusThreshold: 0.7,
  timeLimitMs: 300000,
  allowDissent: true,
  minParticipants: 2,
  maxParticipants: 5,
  enableLearning: true,
  enableHotReload: true,
  tokenBudget: 100000,
};

export type PersonaMeshEventName =
  | "persona:registered"
  | "persona:unregistered"
  | "persona:activated"
  | "persona:deactivated"
  | "persona:updated"
  | "debate:started"
  | "debate:round_started"
  | "debate:proposal_added"
  | "debate:critique_added"
  | "debate:defense_added"
  | "debate:vote_cast"
  | "debate:completed"
  | "debate:timed_out"
  | "combination:created"
  | "combination:optimized"
  | "learning:adapted"
  | "engine:initialized"
  | "engine:shutdown";

export interface PersonaMeshEvent {
  type: PersonaMeshEventName;
  timestamp: string;
  data: Record<string, unknown>;
}

export type PersonaMeshEventHandler = (event: PersonaMeshEvent) => void;

export interface PersonaMeshEvents {
  on(event: PersonaMeshEventName, handler: PersonaMeshEventHandler): void;
  off(event: PersonaMeshEventName, handler: PersonaMeshEventHandler): void;
  emit(event: PersonaMeshEvent): void;
}

export interface ScoringCriteria {
  feasibility: number;
  completeness: number;
  efficiency: number;
  risk: number;
  innovation: number;
}

export const DEFAULT_SCORING_CRITERIA: ScoringCriteria = {
  feasibility: 0.25,
  completeness: 0.2,
  efficiency: 0.2,
  risk: 0.15,
  innovation: 0.2,
};

export interface DebateResultInternal {
  outcome: DebateOutcome;
  winningProposalId: string | null;
  consensusLevel: number;
  keyInsights: string[];
  unresolvedIssues: string[];
  finalSynthesis: string;
  duration: number;
  roundSummaries: string[];
  consensusPoints: string[];
  disagreementPoints: string[];
  rankedProposals: RankedProposal[];
  report: string;
}

export interface RankedProposal {
  proposalId: string;
  personaId: InternalPersonaId;
  content: string;
  finalScore: number;
  rank: number;
}

export interface PersonaActivationInternal {
  personaId: InternalPersonaId;
  state: PersonaState;
  activatedAt: string;
  context: string;
  energyLevel: number;
}

export interface PersonaCombinationInternal {
  id: string;
  personaIds: InternalPersonaId[];
  strategy: CombinationStrategy;
  synergyScore: number;
  coverageScore: number;
  conflictScore: number;
  estimatedTokenCost: number;
  recommended: boolean;
  sharedMemory: Map<string, unknown>;
}

export interface EarlyTerminationCondition {
  consensusReached: boolean;
  timeExceeded: boolean;
  maxRoundsExceeded: boolean;
  allProposalsRejected: boolean;
  customCondition?: () => boolean;
}
