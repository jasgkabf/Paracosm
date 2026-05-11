import type { Timestamped, Identified } from "./common.js";
import type { EntityId } from "./world-model.js";

export type PersonaId = string & { readonly __brand: unique symbol };

export enum PersonaRole {
  Analyst = "analyst",
  Critic = "critic",
  Optimist = "optimist",
  Pessimist = "pessimist",
  Synthesizer = "synthesizer",
  Innovator = "innovator",
  Pragmatist = "pragmatist",
  Explorer = "explorer",
  Guardian = "guardian",
  Strategist = "strategist",
}

export interface PersonaTrait {
  name: string;
  intensity: number;
  description: string;
}

export interface PersonaBias {
  name: string;
  direction: "positive" | "negative" | "neutral";
  strength: number;
  domain: string;
}

export interface Persona extends Identified, Timestamped {
  name: string;
  role: PersonaRole;
  description: string;
  traits: PersonaTrait[];
  biases: PersonaBias[];
  expertise: string[];
  communicationStyle: string;
  systemPrompt: string;
}

export interface PersonaConfig {
  personaIds: PersonaId[];
  debateRounds: number;
  consensusThreshold: number;
  timeLimitMs: number;
  allowDissent: boolean;
  minParticipants: number;
  maxParticipants: number;
}

export enum PersonaState {
  Idle = "idle",
  Thinking = "thinking",
  Debating = "debating",
  Synthesizing = "synthesizing",
  Voting = "voting",
  Error = "error",
}

export interface PersonaActivation {
  personaId: PersonaId;
  state: PersonaState;
  activatedAt: string;
  context: string;
  energyLevel: number;
}

export type DebateRoundId = string;

export interface DebateProposal {
  id: string;
  personaId: PersonaId;
  roundId: DebateRoundId;
  content: string;
  confidence: number;
  supportingEvidence: string[];
  assumptions: string[];
  timestamp: string;
}

export interface DebateCritique {
  id: string;
  criticId: PersonaId;
  proposalId: string;
  roundId: DebateRoundId;
  content: string;
  severity: "low" | "medium" | "high";
  addressedPoints: string[];
  counterEvidence: string[];
  timestamp: string;
}

export interface DebateRound {
  id: DebateRoundId;
  roundNumber: number;
  proposals: DebateProposal[];
  critiques: DebateCritique[];
  startTime: string;
  endTime: string | null;
  summary: string | null;
}

export enum DebateVoteType {
  For = "for",
  Against = "against",
  Abstain = "abstain",
}

export interface DebateVote {
  personaId: PersonaId;
  proposalId: string;
  vote: DebateVoteType;
  reasoning: string;
  weight: number;
  timestamp: string;
}

export enum DebateOutcome {
  Consensus = "consensus",
  Majority = "majority",
  Disagreement = "disagreement",
  Inconclusive = "inconclusive",
}

export interface DebateResult {
  outcome: DebateOutcome;
  winningProposalId: string | null;
  votes: DebateVote[];
  consensusLevel: number;
  keyInsights: string[];
  unresolvedIssues: string[];
  finalSynthesis: string;
  duration: number;
}

export interface PersonaCombination {
  id: string;
  personaIds: PersonaId[];
  synergyScore: number;
  coverageScore: number;
  conflictScore: number;
  recommended: boolean;
}

export interface PersonaDebate {
  id: string;
  config: PersonaConfig;
  rounds: DebateRound[];
  result: DebateResult | null;
  participants: PersonaActivation[];
  status: "pending" | "active" | "completed" | "failed";
  createdAt: string;
  completedAt: string | null;
}
