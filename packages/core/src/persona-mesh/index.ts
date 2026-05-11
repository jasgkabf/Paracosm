export { Persona } from "./persona.js";
export { PersonaRegistry } from "./persona-registry.js";
export { PersonaCombiner } from "./persona-combiner.js";
export { DebateProtocol } from "./debate-protocol.js";
export { DebateRound } from "./debate-round.js";
export { DebateAggregator } from "./debate-aggregator.js";
export { DebateScoring } from "./debate-scoring.js";
export { PersonaLearning } from "./persona-learning.js";
export { PersonaMeshEngine } from "./mesh-engine.js";
export { ArchitectPersona, ExecutorPersona, CriticPersona, DreamerPersona, CuratorPersona } from "./personas/index.js";

export type {
  InternalPersonaId,
  PersonaInternal,
  PersonaCreateConfig,
  DebateContext,
  DebatePhase,
  DebateMessage,
  DebateRoundData,
  ProposalData,
  CritiqueData,
  DefenseData,
  VoteData,
  PersonaPerformance,
  AdaptationEntry,
  CombinationStrategy,
  PersonaMeshConfig,
  PersonaMeshEvent,
  PersonaMeshEventName,
  PersonaMeshEventHandler,
  PersonaMeshEvents,
  ScoringCriteria,
  DebateResultInternal,
  RankedProposal,
  PersonaActivationInternal,
  PersonaCombinationInternal,
  EarlyTerminationCondition,
} from "./types.js";

export {
  DebatePhase as DebatePhaseEnum,
  DEFAULT_PERSONA_MESH_CONFIG,
  DEFAULT_SCORING_CRITERIA,
} from "./types.js";
