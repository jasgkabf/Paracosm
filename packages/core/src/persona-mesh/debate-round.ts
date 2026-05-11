import type { DebateProposal, DebateCritique, DebateVote } from '@paracosm/shared';
import { generateId, createLogger } from '@paracosm/shared';

const logger = createLogger('DebateRound');

export interface RoundState {
  roundNumber: number;
  proposals: DebateProposal[];
  critiques: DebateCritique[];
  votes: DebateVote[];
  status: 'collecting_proposals' | 'collecting_critiques' | 'voting' | 'completed';
  startedAt: Date;
  completedAt?: Date;
}

export class DebateRound {
  private state: RoundState;
  private listeners: Array<(event: string, data: unknown) => void> = [];

  constructor(roundNumber: number) {
    this.state = {
      roundNumber,
      proposals: [],
      critiques: [],
      votes: [],
      status: 'collecting_proposals',
      startedAt: new Date(),
    };
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

  addProposal(proposal: DebateProposal): boolean {
    if (this.state.status !== 'collecting_proposals') return false;
    this.state.proposals.push(proposal);
    logger.debug(`Round ${this.state.roundNumber}: Added proposal from ${proposal.personaId}`);
    return true;
  }

  transitionToCritiques(): boolean {
    if (this.state.status !== 'collecting_proposals') return false;
    if (this.state.proposals.length === 0) return false;
    this.state.status = 'collecting_critiques';
    this.emit('round:critique_phase', this.state);
    return true;
  }

  addCritique(critique: DebateCritique): boolean {
    if (this.state.status !== 'collecting_critiques') return false;
    this.state.critiques.push(critique);
    return true;
  }

  transitionToVoting(): boolean {
    if (this.state.status !== 'collecting_critiques') return false;
    this.state.status = 'voting';
    this.emit('round:voting_phase', this.state);
    return true;
  }

  addVote(vote: DebateVote): boolean {
    if (this.state.status !== 'voting') return false;
    this.state.votes.push(vote);
    return true;
  }

  complete(): RoundState {
    this.state.status = 'completed';
    this.state.completedAt = new Date();
    this.emit('round:completed', this.state);
    return this.state;
  }

  getState(): RoundState {
    return { ...this.state };
  }

  getRoundNumber(): number {
    return this.state.roundNumber;
  }

  getProposals(): DebateProposal[] {
    return [...this.state.proposals];
  }

  getCritiques(): DebateCritique[] {
    return [...this.state.critiques];
  }

  getVotes(): DebateVote[] {
    return [...this.state.votes];
  }

  getStatus(): RoundState['status'] {
    return this.state.status;
  }

  getProposalScores(): Map<string, { totalScore: number; voteCount: number; averageScore: number }> {
    const scores = new Map<string, { totalScore: number; voteCount: number; averageScore: number }>();
    for (const vote of this.state.votes) {
      const current = scores.get(vote.proposalId) ?? { totalScore: 0, voteCount: 0, averageScore: 0 };
      current.totalScore += vote.score;
      current.voteCount += 1;
      current.averageScore = current.totalScore / current.voteCount;
      scores.set(vote.proposalId, current);
    }
    return scores;
  }

  getWinningProposal(): { proposalId: string; score: number } | null {
    const scores = this.getProposalScores();
    let best: { proposalId: string; score: number } | null = null;
    for (const [proposalId, data] of scores) {
      if (!best || data.averageScore > best.score) {
        best = { proposalId, score: data.averageScore };
      }
    }
    return best;
  }
}
