import type { Persona, DebateResult, DebateProposal, DebateCritique, DebateVote } from '@paracosm/shared';
import { generateId, ok, err, type Result, createLogger } from '@paracosm/shared';
import type { MeshConfig } from './types.js';
import { DEFAULT_MESH_CONFIG } from './types.js';

const logger = createLogger('DebateProtocol');

export interface DebateSession {
  id: string;
  topic: string;
  participants: string[];
  maxRounds: number;
  currentRound: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
  proposals: DebateProposal[];
  critiques: DebateCritique[];
  votes: DebateVote[];
  result?: DebateResult;
  startedAt?: Date;
  completedAt?: Date;
}

export class DebateProtocol {
  private config: MeshConfig;
  private sessions: Map<string, DebateSession> = new Map();
  private listeners: Array<(event: string, data: unknown) => void> = [];

  constructor(config: Partial<MeshConfig> = {}) {
    this.config = { ...DEFAULT_MESH_CONFIG, ...config };
  }

  on(listener: (event: string, data: unknown) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  private emit(event: string, data: unknown): void {
    for (const listener of this.listeners) {
      listener(event, data);
    }
  }

  createSession(topic: string, participantIds: string[]): Result<DebateSession> {
    if (participantIds.length < 2) {
      return err(new Error('At least 2 participants required for debate'));
    }
    if (!this.config.debateEnabled) {
      return err(new Error('Debate is disabled in configuration'));
    }
    const session: DebateSession = {
      id: generateId(),
      topic,
      participants: participantIds,
      maxRounds: this.config.maxDebateRounds,
      currentRound: 0,
      status: 'pending',
      proposals: [],
      critiques: [],
      votes: [],
    };
    this.sessions.set(session.id, session);
    logger.info(`Created debate session: ${session.id} on topic: ${topic}`);
    this.emit('debate:created', session);
    return ok(session);
  }

  startSession(sessionId: string): Result<DebateSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return err(new Error(`Session ${sessionId} not found`));
    }
    if (session.status !== 'pending') {
      return err(new Error(`Session ${sessionId} is not in pending state`));
    }
    session.status = 'active';
    session.currentRound = 1;
    session.startedAt = new Date();
    logger.info(`Started debate session: ${sessionId}`);
    this.emit('debate:started', session);
    return ok(session);
  }

  submitProposal(sessionId: string, proposal: DebateProposal): Result<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return err(new Error(`Session ${sessionId} not found`));
    }
    if (session.status !== 'active') {
      return err(new Error(`Session ${sessionId} is not active`));
    }
    if (!session.participants.includes(proposal.personaId)) {
      return err(new Error(`Persona ${proposal.personaId} is not a participant`));
    }
    session.proposals.push(proposal);
    this.emit('debate:proposal', { sessionId, proposal });
    return ok(true);
  }

  submitCritique(sessionId: string, critique: DebateCritique): Result<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return err(new Error(`Session ${sessionId} not found`));
    }
    if (session.status !== 'active') {
      return err(new Error(`Session ${sessionId} is not active`));
    }
    session.critiques.push(critique);
    this.emit('debate:critique', { sessionId, critique });
    return ok(true);
  }

  submitVote(sessionId: string, vote: DebateVote): Result<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return err(new Error(`Session ${sessionId} not found`));
    }
    if (session.status !== 'active') {
      return err(new Error(`Session ${sessionId} is not active`));
    }
    session.votes.push(vote);
    this.emit('debate:vote', { sessionId, vote });
    return ok(true);
  }

  advanceRound(sessionId: string): Result<DebateSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return err(new Error(`Session ${sessionId} not found`));
    }
    if (session.status !== 'active') {
      return err(new Error(`Session ${sessionId} is not active`));
    }
    if (session.currentRound >= session.maxRounds) {
      return this.completeSession(sessionId);
    }
    session.currentRound++;
    logger.info(`Advanced debate session ${sessionId} to round ${session.currentRound}`);
    this.emit('debate:round_advanced', session);
    return ok(session);
  }

  completeSession(sessionId: string): Result<DebateSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return err(new Error(`Session ${sessionId} not found`));
    }
    session.status = 'completed';
    session.completedAt = new Date();
    const result = this.computeResult(session);
    session.result = result;
    logger.info(`Completed debate session: ${sessionId}`, { winner: result.winner, confidence: result.confidence });
    this.emit('debate:completed', session);
    return ok(session);
  }

  private computeResult(session: DebateSession): DebateResult {
    const proposalScores = new Map<string, number>();
    for (const vote of session.votes) {
      const current = proposalScores.get(vote.proposalId) ?? 0;
      proposalScores.set(vote.proposalId, current + vote.score);
    }
    let winnerId: string | undefined;
    let highestScore = -Infinity;
    for (const [proposalId, score] of proposalScores) {
      if (score > highestScore) {
        highestScore = score;
        winnerId = proposalId;
      }
    }
    const winnerProposal = session.proposals.find((p) => p.personaId === winnerId);
    const totalVotes = session.votes.length;
    const winnerVotes = session.votes.filter((v) => v.proposalId === winnerId).length;
    const confidence = totalVotes > 0 ? winnerVotes / totalVotes : 0;
    const duration = session.completedAt && session.startedAt
      ? session.completedAt.getTime() - session.startedAt.getTime()
      : 0;
    const consensus = winnerProposal
      ? winnerProposal.content
      : 'No consensus reached';
    return {
      id: generateId(),
      topic: session.topic,
      rounds: [],
      winner: winnerId,
      consensus,
      confidence,
      duration,
      timestamp: new Date(),
    };
  }

  checkConsensus(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.votes.length === 0) return false;
    const proposalVoteCounts = new Map<string, number>();
    for (const vote of session.votes) {
      proposalVoteCounts.set(vote.proposalId, (proposalVoteCounts.get(vote.proposalId) ?? 0) + 1);
    }
    const maxVotes = Math.max(...proposalVoteCounts.values());
    const consensusRatio = maxVotes / session.votes.length;
    return consensusRatio >= this.config.consensusThreshold;
  }

  getSession(sessionId: string): DebateSession | undefined {
    return this.sessions.get(sessionId);
  }

  getActiveSessions(): DebateSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === 'active');
  }

  getAllSessions(): DebateSession[] {
    return Array.from(this.sessions.values());
  }

  clear(): void {
    this.sessions.clear();
    this.emit('debate:cleared', null);
  }
}
