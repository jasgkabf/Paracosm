import type { DebateResult, DebateProposal, DebateCritique, DebateVote } from '@paracosm/shared';
import { generateId, createLogger } from '@paracosm/shared';

const logger = createLogger('DebateAggregator');

export interface AggregatedResult {
  id: string;
  topic: string;
  totalProposals: number;
  totalCritiques: number;
  totalVotes: number;
  proposalRankings: Array<{
    proposalId: string;
    personaId: string;
    averageScore: number;
    rank: number;
    voteCount: number;
  }>;
  consensusLevel: number;
  topProposal: DebateProposal | null;
  keyCritiques: DebateCritique[];
  summary: string;
  timestamp: Date;
}

export class DebateAggregator {
  aggregate(
    proposals: DebateProposal[],
    critiques: DebateCritique[],
    votes: DebateVote[],
    topic: string,
  ): AggregatedResult {
    const proposalScores = new Map<string, { totalScore: number; voteCount: number; scores: number[] }>();
    for (const vote of votes) {
      const current = proposalScores.get(vote.proposalId) ?? { totalScore: 0, voteCount: 0, scores: [] };
      current.totalScore += vote.score;
      current.voteCount += 1;
      current.scores.push(vote.score);
      proposalScores.set(vote.proposalId, current);
    }

    const rankings: AggregatedResult['proposalRankings'] = [];
    for (const [proposalId, data] of proposalScores) {
      const proposal = proposals.find((p) => p.personaId === proposalId);
      rankings.push({
        proposalId,
        personaId: proposal?.personaId ?? '',
        averageScore: data.voteCount > 0 ? data.totalScore / data.voteCount : 0,
        rank: 0,
        voteCount: data.voteCount,
      });
    }
    rankings.sort((a, b) => b.averageScore - a.averageScore);
    rankings.forEach((r, i) => { r.rank = i + 1; });

    const topProposal = rankings.length > 0
      ? proposals.find((p) => p.personaId === rankings[0].proposalId) ?? null
      : null;

    const keyCritiques = this.selectKeyCritiques(critiques, 5);

    const consensusLevel = this.computeConsensusLevel(votes, rankings);

    const summary = this.generateSummary(topic, rankings, keyCritiques, consensusLevel);

    return {
      id: generateId(),
      topic,
      totalProposals: proposals.length,
      totalCritiques: critiques.length,
      totalVotes: votes.length,
      proposalRankings: rankings,
      consensusLevel,
      topProposal,
      keyCritiques,
      summary,
      timestamp: new Date(),
    };
  }

  private selectKeyCritiques(critiques: DebateCritique[], maxCount: number): DebateCritique[] {
    const sorted = [...critiques].sort((a, b) => b.severity - a.severity);
    return sorted.slice(0, maxCount);
  }

  private computeConsensusLevel(votes: DebateVote[], rankings: AggregatedResult['proposalRankings']): number {
    if (votes.length === 0 || rankings.length === 0) return 0;
    const topScore = rankings[0].averageScore;
    const totalScore = rankings.reduce((sum, r) => sum + r.averageScore, 0);
    if (totalScore === 0) return 0;
    return topScore / totalScore;
  }

  private generateSummary(
    topic: string,
    rankings: AggregatedResult['proposalRankings'],
    keyCritiques: DebateCritique[],
    consensusLevel: number,
  ): string {
    const parts: string[] = [];
    parts.push(`Debate on "${topic}" concluded.`);
    if (rankings.length > 0) {
      parts.push(`Top proposal scored ${rankings[0].averageScore.toFixed(2)} with ${rankings[0].voteCount} votes.`);
    }
    if (consensusLevel >= 0.75) {
      parts.push('Strong consensus was reached.');
    } else if (consensusLevel >= 0.5) {
      parts.push('Moderate consensus was reached.');
    } else {
      parts.push('No strong consensus was reached.');
    }
    if (keyCritiques.length > 0) {
      parts.push(`${keyCritiques.length} key critiques were identified.`);
    }
    return parts.join(' ');
  }
}
