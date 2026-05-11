import { DebateOutcome } from "@paracosm/shared";
import { DebateScoring } from "./debate-scoring.js";
import type {
  ProposalData,
  CritiqueData,
  DefenseData,
  VoteData,
  DebateRoundData,
  DebateResultInternal,
  RankedProposal,
  ScoringCriteria,
} from "./types.js";
import { DEFAULT_SCORING_CRITERIA } from "./types.js";

export class DebateAggregator {
  private scoring: DebateScoring;

  constructor(scoring?: DebateScoring) {
    this.scoring = scoring ?? new DebateScoring();
  }

  aggregate(rounds: DebateRoundData[]): DebateResultInternal {
    const allProposals = this.collectProposals(rounds);
    const allCritiques = this.collectCritiques(rounds);
    const allDefenses = this.collectDefenses(rounds);
    const allVotes = this.collectVotes(rounds);

    const rankedProposals = this.rank(allProposals, allCritiques, allDefenses);

    const consensusPoints = this.findConsensus(rounds);
    const disagreementPoints = this.findDisagreements(rounds);

    const consensusLevel = this.calculateConsensusLevel(allVotes);

    const outcome = this.determineOutcome(consensusLevel, rankedProposals);

    const winningProposal = rankedProposals.length > 0 ? rankedProposals[0] : null;

    const keyInsights = this.extractKeyInsights(allProposals, allCritiques);
    const unresolvedIssues = this.resolveDisagreement(disagreementPoints);

    const finalSynthesis = this.synthesize(allProposals, rankedProposals, consensusPoints, unresolvedIssues);

    const roundSummaries = rounds.map((r, i) => {
      if (r.summary) return r.summary;
      return `Round ${i + 1}: ${r.proposals.length} proposals, ${r.critiques.length} critiques, ${r.defenses.length} defenses`;
    });

    const report = this.generateReport(outcome, winningProposal, consensusLevel, keyInsights, unresolvedIssues, roundSummaries, consensusPoints, disagreementPoints);

    return {
      outcome,
      winningProposalId: winningProposal?.proposalId ?? null,
      consensusLevel,
      keyInsights,
      unresolvedIssues,
      finalSynthesis,
      duration: 0,
      roundSummaries,
      consensusPoints,
      disagreementPoints,
      rankedProposals,
      report,
    };
  }

  rank(
    proposals: ProposalData[],
    critiques?: CritiqueData[],
    defenses?: DefenseData[]
  ): RankedProposal[] {
    const allCritiques = critiques ?? [];
    const allDefenses = defenses ?? [];

    const ranked = proposals.map((proposal) => {
      const proposalCritiques = allCritiques.filter((c) => c.proposalId === proposal.id);
      const proposalDefenses = allDefenses.filter((d) => d.proposalId === proposal.id);

      const score = this.scoring.calculateFinalScore(proposal, proposalCritiques, proposalDefenses);

      return {
        proposalId: proposal.id,
        personaId: proposal.personaId,
        content: proposal.content,
        finalScore: score,
        rank: 0,
      };
    });

    ranked.sort((a, b) => b.finalScore - a.finalScore);

    for (let i = 0; i < ranked.length; i++) {
      ranked[i].rank = i + 1;
    }

    return ranked;
  }

  synthesize(proposals: ProposalData[], ranked?: RankedProposal[], consensusPoints?: string[], unresolvedIssues?: string[]): string {
    const topProposals = ranked
      ? ranked.slice(0, 3)
      : this.rank(proposals).slice(0, 3);

    if (topProposals.length === 0) {
      return "No proposals were submitted during the debate.";
    }

    const parts: string[] = [];

    parts.push("Synthesis of debate proposals:");

    for (const proposal of topProposals) {
      const original = proposals.find((p) => p.id === proposal.proposalId);
      const keyPoint = original
        ? original.content.split(/[.!?]/)[0]?.trim() ?? original.content.substring(0, 100)
        : proposal.content.substring(0, 100);
      parts.push(`[${proposal.rank}] (score: ${proposal.finalScore.toFixed(2)}) ${keyPoint}`);
    }

    if (consensusPoints && consensusPoints.length > 0) {
      parts.push("");
      parts.push("Areas of agreement:");
      for (const point of consensusPoints.slice(0, 5)) {
        parts.push(`  + ${point}`);
      }
    }

    if (unresolvedIssues && unresolvedIssues.length > 0) {
      parts.push("");
      parts.push("Areas requiring further discussion:");
      for (const issue of unresolvedIssues.slice(0, 5)) {
        parts.push(`  ? ${issue}`);
      }
    }

    if (topProposals.length >= 2) {
      parts.push("");
      parts.push("Recommended approach: Combine the top-ranked proposal with elements from the second proposal to address gaps.");
    }

    return parts.join("\n");
  }

  findConsensus(rounds: DebateRoundData[]): string[] {
    const consensusPoints: string[] = [];

    const allVotes = this.collectVotes(rounds);
    const allProposals = this.collectProposals(rounds);

    const proposalVoteMap = new Map<string, VoteData[]>();
    for (const vote of allVotes) {
      if (!proposalVoteMap.has(vote.proposalId)) {
        proposalVoteMap.set(vote.proposalId, []);
      }
      proposalVoteMap.get(vote.proposalId)!.push(vote);
    }

    for (const proposal of allProposals) {
      const votes = proposalVoteMap.get(proposal.id) ?? [];
      if (votes.length >= 2) {
        const avgScore = votes.reduce((s, v) => s + v.score, 0) / votes.length;
        const scoreVariance = votes.reduce((s, v) => s + Math.pow(v.score - avgScore, 2), 0) / votes.length;

        if (avgScore >= 7 && scoreVariance < 4) {
          const keyPoint = proposal.content.split(/[.!?]/)[0]?.trim();
          if (keyPoint && keyPoint.length > 0) {
            consensusPoints.push(keyPoint);
          }
        }
      }
    }

    const crossRoundThemes = this.findCrossRoundThemes(rounds);
    for (const theme of crossRoundThemes) {
      if (!consensusPoints.some((p) => p.includes(theme))) {
        consensusPoints.push(theme);
      }
    }

    return [...new Set(consensusPoints)].slice(0, 10);
  }

  findDisagreements(rounds: DebateRoundData[]): string[] {
    const disagreements: string[] = [];

    const allVotes = this.collectVotes(rounds);

    const proposalVoteMap = new Map<string, VoteData[]>();
    for (const vote of allVotes) {
      if (!proposalVoteMap.has(vote.proposalId)) {
        proposalVoteMap.set(vote.proposalId, []);
      }
      proposalVoteMap.get(vote.proposalId)!.push(vote);
    }

    for (const [proposalId, votes] of proposalVoteMap) {
      if (votes.length >= 2) {
        const scores = votes.map((v) => v.score);
        const range = Math.max(...scores) - Math.min(...scores);

        if (range >= 4) {
          const lowReasoning = votes.filter((v) => v.score < 4).map((v) => v.reasoning);
          const highReasoning = votes.filter((v) => v.score >= 7).map((v) => v.reasoning);

          if (lowReasoning.length > 0 && highReasoning.length > 0) {
            disagreements.push(`Proposal ${proposalId}: disagreement range ${Math.min(...scores)}-${Math.max(...scores)}. Low-score concern: ${lowReasoning[0].substring(0, 100)}`);
          }
        }
      }
    }

    const allCritiques = this.collectCritiques(rounds);
    const allDefenses = this.collectDefenses(rounds);
    const defendedCritiqueIds = new Set(allDefenses.map((d) => d.critiqueId));

    for (const critique of allCritiques) {
      if (!defendedCritiqueIds.has(critique.id) && critique.severity === "high") {
        const keyPoint = critique.content.split(/[.!?]/)[0]?.trim();
        if (keyPoint && keyPoint.length > 0) {
          disagreements.push(`Unresolved high-severity critique: ${keyPoint}`);
        }
      }
    }

    return [...new Set(disagreements)].slice(0, 10);
  }

  resolveDisagreement(disagreements: string[]): string[] {
    return disagreements.map((disagreement) => {
      if (disagreement.includes("range")) {
        return `${disagreement} -- Recommend further deliberation with additional evidence.`;
      }
      if (disagreement.includes("Unresolved")) {
        return `${disagreement} -- Address in follow-up discussion with targeted rebuttals.`;
      }
      return `${disagreement} -- Requires mediation or additional data.`;
    });
  }

  generateReport(
    outcome: DebateOutcome,
    winningProposal: RankedProposal | null,
    consensusLevel: number,
    keyInsights: string[],
    unresolvedIssues: string[],
    roundSummaries: string[],
    consensusPoints: string[],
    disagreementPoints: string[]
  ): string {
    const lines: string[] = [];

    lines.push("========================================");
    lines.push("         DEBATE AGGREGATION REPORT       ");
    lines.push("========================================");
    lines.push("");

    lines.push(`Outcome: ${outcome}`);
    lines.push(`Consensus Level: ${(consensusLevel * 100).toFixed(1)}%`);
    lines.push("");

    if (winningProposal) {
      lines.push("--- Winning Proposal ---");
      lines.push(`Rank: ${winningProposal.rank}`);
      lines.push(`Score: ${winningProposal.finalScore.toFixed(2)}`);
      lines.push(`Content: ${winningProposal.content.substring(0, 300)}`);
      lines.push("");
    }

    if (consensusPoints.length > 0) {
      lines.push("--- Consensus Points ---");
      for (const point of consensusPoints) {
        lines.push(`  [+] ${point}`);
      }
      lines.push("");
    }

    if (disagreementPoints.length > 0) {
      lines.push("--- Disagreement Points ---");
      for (const point of disagreementPoints) {
        lines.push(`  [-] ${point}`);
      }
      lines.push("");
    }

    if (keyInsights.length > 0) {
      lines.push("--- Key Insights ---");
      for (const insight of keyInsights) {
        lines.push(`  [*] ${insight}`);
      }
      lines.push("");
    }

    if (unresolvedIssues.length > 0) {
      lines.push("--- Unresolved Issues ---");
      for (const issue of unresolvedIssues) {
        lines.push(`  [?] ${issue}`);
      }
      lines.push("");
    }

    if (roundSummaries.length > 0) {
      lines.push("--- Round Summaries ---");
      for (const summary of roundSummaries) {
        lines.push(`  ${summary}`);
      }
    }

    lines.push("");
    lines.push("========================================");

    return lines.join("\n");
  }

  private collectProposals(rounds: DebateRoundData[]): ProposalData[] {
    return rounds.flatMap((r) => r.proposals);
  }

  private collectCritiques(rounds: DebateRoundData[]): CritiqueData[] {
    return rounds.flatMap((r) => r.critiques);
  }

  private collectDefenses(rounds: DebateRoundData[]): DefenseData[] {
    return rounds.flatMap((r) => r.defenses);
  }

  private collectVotes(rounds: DebateRoundData[]): VoteData[] {
    return rounds.flatMap((r) => r.votes);
  }

  private calculateConsensusLevel(votes: VoteData[]): number {
    if (votes.length === 0) return 0;

    const proposalVoteGroups = new Map<string, number[]>();
    for (const vote of votes) {
      if (!proposalVoteGroups.has(vote.proposalId)) {
        proposalVoteGroups.set(vote.proposalId, []);
      }
      proposalVoteGroups.get(vote.proposalId)!.push(vote.score);
    }

    let totalAgreement = 0;
    let groupCount = 0;

    for (const [_, scores] of proposalVoteGroups) {
      if (scores.length < 2) continue;

      const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
      const variance = scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length;
      const stdDev = Math.sqrt(variance);

      const agreement = Math.max(0, 1 - stdDev / 5);
      totalAgreement += agreement;
      groupCount++;
    }

    return groupCount > 0 ? totalAgreement / groupCount : 0;
  }

  private determineOutcome(consensusLevel: number, ranked: RankedProposal[]): DebateOutcome {
    if (consensusLevel >= 0.7 && ranked.length > 0) {
      return DebateOutcome.Consensus;
    }
    if (ranked.length > 0 && ranked[0].finalScore > 5) {
      return DebateOutcome.Majority;
    }
    if (ranked.length > 0) {
      return DebateOutcome.Disagreement;
    }
    return DebateOutcome.Inconclusive;
  }

  private extractKeyInsights(proposals: ProposalData[], critiques: CritiqueData[]): string[] {
    const insights: string[] = [];

    for (const proposal of proposals) {
      if (proposal.confidence > 0.7) {
        const keyPoint = proposal.content.split(/[.!?]/)[0]?.trim();
        if (keyPoint && keyPoint.length > 0) {
          insights.push(keyPoint);
        }
      }
    }

    for (const critique of critiques) {
      if (critique.severity === "high") {
        const keyPoint = critique.content.split(/[.!?]/)[0]?.trim();
        if (keyPoint && keyPoint.length > 0) {
          insights.push(`Critical: ${keyPoint}`);
        }
      }
    }

    return [...new Set(insights)].slice(0, 10);
  }

  private findCrossRoundThemes(rounds: DebateRoundData[]): string[] {
    if (rounds.length < 2) return [];

    const themes: string[] = [];
    const allProposalWords = rounds.map((r) => {
      const words = new Set<string>();
      for (const p of r.proposals) {
        for (const word of p.content.toLowerCase().split(/\s+/)) {
          if (word.length > 5) {
            words.add(word);
          }
        }
      }
      return words;
    });

    if (allProposalWords.length >= 2) {
      for (const word of allProposalWords[0]) {
        let presentInAll = true;
        for (let i = 1; i < allProposalWords.length; i++) {
          if (!allProposalWords[i].has(word)) {
            presentInAll = false;
            break;
          }
        }
        if (presentInAll) {
          themes.push(`Recurring theme: ${word}`);
        }
      }
    }

    return themes.slice(0, 5);
  }
}
