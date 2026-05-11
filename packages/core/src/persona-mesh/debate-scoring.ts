import type { DebateProposal, DebateCritique, DebateVote } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('DebateScoring');

export interface ScoreWeights {
  confidence: number;
  reasoning: number;
  critiqueSeverity: number;
  voteScore: number;
  novelty: number;
  feasibility: number;
}

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  confidence: 0.2,
  reasoning: 0.2,
  critiqueSeverity: 0.15,
  voteScore: 0.25,
  novelty: 0.1,
  feasibility: 0.1,
};

export class DebateScoring {
  private weights: ScoreWeights;

  constructor(weights: Partial<ScoreWeights> = {}) {
    this.weights = { ...DEFAULT_SCORE_WEIGHTS, ...weights };
  }

  scoreProposal(proposal: DebateProposal, critiques: DebateCritique[], votes: DebateVote[]): number {
    const confidenceScore = proposal.confidence;
    const reasoningScore = this.scoreReasoning(proposal.reasoning);
    const critiqueScore = this.scoreCritiques(critiques);
    const voteScore = this.scoreVotes(votes);
    const noveltyScore = this.scoreNovelty(proposal);
    const feasibilityScore = this.scoreFeasibility(proposal);

    const total =
      this.weights.confidence * confidenceScore +
      this.weights.reasoning * reasoningScore +
      this.weights.critiqueSeverity * critiqueScore +
      this.weights.voteScore * voteScore +
      this.weights.novelty * noveltyScore +
      this.weights.feasibility * feasibilityScore;

    return Math.min(Math.max(total, 0), 1);
  }

  private scoreReasoning(reasoning: string): number {
    if (!reasoning || reasoning.length === 0) return 0.1;
    let score = 0.3;
    if (reasoning.length > 50) score += 0.1;
    if (reasoning.length > 150) score += 0.1;
    const logicalKeywords = ['because', 'therefore', 'since', 'however', 'although', 'consequently', 'thus', 'hence'];
    const keywordCount = logicalKeywords.filter((k) => reasoning.toLowerCase().includes(k)).length;
    score += Math.min(keywordCount * 0.1, 0.3);
    return Math.min(score, 1);
  }

  private scoreCritiques(critiques: DebateCritique[]): number {
    if (critiques.length === 0) return 0.5;
    const avgSeverity = critiques.reduce((sum, c) => sum + c.severity, 0) / critiques.length;
    return 1 - (avgSeverity / 10);
  }

  private scoreVotes(votes: DebateVote[]): number {
    if (votes.length === 0) return 0.3;
    const avgScore = votes.reduce((sum, v) => sum + v.score, 0) / votes.length;
    return Math.min(avgScore / 10, 1);
  }

  private scoreNovelty(proposal: DebateProposal): number {
    const alternativeCount = proposal.alternatives.length;
    return Math.min(0.3 + alternativeCount * 0.15, 1);
  }

  private scoreFeasibility(proposal: DebateProposal): number {
    let score = 0.5;
    if (proposal.confidence > 0.7) score += 0.2;
    if (proposal.confidence > 0.9) score += 0.1;
    if (proposal.alternatives.length > 0) score += 0.1;
    return Math.min(score, 1);
  }

  rankProposals(
    proposals: DebateProposal[],
    critiques: DebateCritique[],
    votes: DebateVote[],
  ): Array<{ proposal: DebateProposal; score: number; rank: number }> {
    const scored = proposals.map((proposal) => {
      const proposalCritiques = critiques.filter((c) => c.targetProposalId === proposal.personaId);
      const proposalVotes = votes.filter((v) => v.proposalId === proposal.personaId);
      const score = this.scoreProposal(proposal, proposalCritiques, proposalVotes);
      return { proposal, score, rank: 0 };
    });
    scored.sort((a, b) => b.score - a.score);
    scored.forEach((item, index) => { item.rank = index + 1; });
    return scored;
  }

  computeConsensus(votes: DebateVote[], threshold: number = 0.75): { reached: boolean; level: number; dominantProposal: string | null } {
    if (votes.length === 0) return { reached: false, level: 0, dominantProposal: null };
    const proposalVotes = new Map<string, number>();
    for (const vote of votes) {
      proposalVotes.set(vote.proposalId, (proposalVotes.get(vote.proposalId) ?? 0) + 1);
    }
    const total = votes.length;
    let maxVotes = 0;
    let dominantProposal: string | null = null;
    for (const [proposalId, count] of proposalVotes) {
      if (count > maxVotes) {
        maxVotes = count;
        dominantProposal = proposalId;
      }
    }
    const level = maxVotes / total;
    return { reached: level >= threshold, level, dominantProposal };
  }

  setWeights(weights: Partial<ScoreWeights>): void {
    this.weights = { ...this.weights, ...weights };
  }

  getWeights(): ScoreWeights {
    return { ...this.weights };
  }
}
