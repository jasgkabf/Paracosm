import { DebateOutcome } from "@paracosm/shared";
import { generateId } from "@paracosm/shared";
import { DebateRound } from "./debate-round.js";
import { DebateScoring } from "./debate-scoring.js";
import { DebatePhase } from "./types.js";
import type {
  InternalPersonaId,
  DebateContext,
  ProposalData,
  CritiqueData,
  DefenseData,
  VoteData,
  DebateRoundData,
  EarlyTerminationCondition,
  PersonaMeshEvent,
  PersonaMeshEventName,
  PersonaMeshEventHandler,
} from "./types.js";
import { DEFAULT_PERSONA_MESH_CONFIG } from "./types.js";

export class DebateProtocol {
  private context: DebateContext | null;
  private rounds: DebateRound[];
  private scoring: DebateScoring;
  private timer: ReturnType<typeof setTimeout> | null;
  private earlyTerminationCondition: EarlyTerminationCondition | null;
  private eventHandlers: Map<PersonaMeshEventName, Set<PersonaMeshEventHandler>>;
  private maxRounds: number;

  constructor() {
    this.context = null;
    this.rounds = [];
    this.scoring = new DebateScoring();
    this.timer = null;
    this.earlyTerminationCondition = null;
    this.eventHandlers = new Map();
    this.maxRounds = DEFAULT_PERSONA_MESH_CONFIG.debateRounds;
  }

  initiate(topic: string, personaIds: InternalPersonaId[]): DebateContext {
    if (personaIds.length < DEFAULT_PERSONA_MESH_CONFIG.minParticipants) {
      throw new Error(`At least ${DEFAULT_PERSONA_MESH_CONFIG.minParticipants} participants required`);
    }

    if (personaIds.length > DEFAULT_PERSONA_MESH_CONFIG.maxParticipants) {
      throw new Error(`At most ${DEFAULT_PERSONA_MESH_CONFIG.maxParticipants} participants allowed`);
    }

    const context: DebateContext = {
      id: generateId(),
      topic,
      personaIds: [...personaIds],
      phase: DebatePhase.Opening,
      rounds: [],
      currentRoundNumber: 0,
      startTime: new Date().toISOString(),
      endTime: null,
      timeLimitMs: null,
      status: "active",
      sharedMemory: new Map(),
    };

    this.context = context;
    this.rounds = [];

    this.emit({
      type: "debate:started",
      timestamp: new Date().toISOString(),
      data: { debateId: context.id, topic, personaIds },
    });

    return context;
  }

  propose(personaId: InternalPersonaId, content: string, confidence: number = 0.5, supportingEvidence: string[] = [], assumptions: string[] = []): DebateRound {
    this.ensureContext();
    this.ensurePhase(DebatePhase.Proposals);

    let currentRound = this.getCurrentRound();
    if (!currentRound) {
      currentRound = this.startNewRound();
    }

    if (!this.context!.personaIds.includes(personaId)) {
      throw new Error(`Persona ${personaId} is not a participant in this debate`);
    }

    const proposalId = currentRound.addProposal(personaId, content, confidence, supportingEvidence, assumptions);

    this.emit({
      type: "debate:proposal_added",
      timestamp: new Date().toISOString(),
      data: { debateId: this.context!.id, proposalId, personaId, roundNumber: currentRound.getRoundNumber() },
    });

    return currentRound;
  }

  critique(personaId: InternalPersonaId, targetProposalId: string, content: string, severity: "low" | "medium" | "high" = "medium", addressedPoints: string[] = [], counterEvidence: string[] = []): void {
    this.ensureContext();
    this.ensurePhase(DebatePhase.Critiques);

    const currentRound = this.getCurrentRound();
    if (!currentRound) {
      throw new Error("No active round to add critique");
    }

    if (!this.context!.personaIds.includes(personaId)) {
      throw new Error(`Persona ${personaId} is not a participant in this debate`);
    }

    const proposal = currentRound.getProposal(targetProposalId);
    if (!proposal) {
      throw new Error(`Proposal ${targetProposalId} not found in current round`);
    }

    if (proposal.personaId === personaId) {
      throw new Error("Cannot critique your own proposal");
    }

    const critiqueId = currentRound.addCritique(targetProposalId, personaId, content, severity, addressedPoints, counterEvidence);

    this.emit({
      type: "debate:critique_added",
      timestamp: new Date().toISOString(),
      data: { debateId: this.context!.id, critiqueId, proposalId: targetProposalId, personaId },
    });
  }

  defend(personaId: InternalPersonaId, critiqueId: string, content: string, conceded: string[] = [], rebutted: string[] = []): void {
    this.ensureContext();
    this.ensurePhase(DebatePhase.Defenses);

    const currentRound = this.getCurrentRound();
    if (!currentRound) {
      throw new Error("No active round to add defense");
    }

    if (!this.context!.personaIds.includes(personaId)) {
      throw new Error(`Persona ${personaId} is not a participant in this debate`);
    }

    const critique = currentRound.getCritique(critiqueId);
    if (!critique) {
      throw new Error(`Critique ${critiqueId} not found in current round`);
    }

    if (critique.personaId === personaId) {
      throw new Error("Cannot defend against your own critique");
    }

    currentRound.addDefense(critique.proposalId, critiqueId, personaId, content, conceded, rebutted);

    this.emit({
      type: "debate:defense_added",
      timestamp: new Date().toISOString(),
      data: { debateId: this.context!.id, critiqueId, personaId },
    });
  }

  vote(personaId: InternalPersonaId, proposalId: string, score: number, reasoning: string): void {
    this.ensureContext();
    this.ensurePhase(DebatePhase.Voting);

    const currentRound = this.getCurrentRound();
    if (!currentRound) {
      throw new Error("No active round to vote");
    }

    if (!this.context!.personaIds.includes(personaId)) {
      throw new Error(`Persona ${personaId} is not a participant in this debate`);
    }

    const proposal = currentRound.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found in current round`);
    }

    if (proposal.personaId === personaId) {
      throw new Error("Cannot vote on your own proposal");
    }

    currentRound.addVote(proposalId, personaId, score, reasoning);

    this.emit({
      type: "debate:vote_cast",
      timestamp: new Date().toISOString(),
      data: { debateId: this.context!.id, proposalId, personaId, score },
    });
  }

  conclude(): import("./types.js").DebateResultInternal {
    this.ensureContext();

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.context!.phase = DebatePhase.Conclusion;
    this.context!.endTime = new Date().toISOString();
    this.context!.status = "completed";

    const currentRound = this.getCurrentRound();
    if (currentRound) {
      currentRound.conclude();
    }

    const allProposals = this.getAllProposals();
    const allCritiques = this.getAllCritiques();
    const allDefenses = this.getAllDefenses();
    const allVotes = this.getAllVotes();

    const rankedProposals = this.rankProposals(allProposals, allCritiques, allDefenses, allVotes);

    const winningProposal = rankedProposals.length > 0 ? rankedProposals[0] : null;

    const consensusLevel = this.calculateConsensusLevel(allVotes);

    const outcome = this.determineOutcome(consensusLevel, rankedProposals);

    const keyInsights = this.extractKeyInsights(allProposals, allCritiques);
    const unresolvedIssues = this.extractUnresolvedIssues(allCritiques, allDefenses);
    const finalSynthesis = this.synthesizeConclusion(winningProposal, keyInsights, unresolvedIssues);
    const roundSummaries = this.rounds.map((r) => r.getSummary() ?? `Round ${r.getRoundNumber()}: ${r.proposalCount()} proposals, ${r.critiqueCount()} critiques`);

    const consensusPoints = this.findConsensusPoints(allProposals, allVotes);
    const disagreementPoints = this.findDisagreementPoints(allVotes);

    const startTime = new Date(this.context!.startTime).getTime();
    const endTime = new Date(this.context!.endTime).getTime();
    const duration = endTime - startTime;

    const report = this.generateDebateReport(
      this.context!.topic,
      outcome,
      winningProposal,
      consensusLevel,
      keyInsights,
      unresolvedIssues,
      roundSummaries
    );

    const result: import("./types.js").DebateResultInternal = {
      outcome,
      winningProposalId: winningProposal?.proposalId ?? null,
      consensusLevel,
      keyInsights,
      unresolvedIssues,
      finalSynthesis,
      duration,
      roundSummaries,
      consensusPoints,
      disagreementPoints,
      rankedProposals,
      report,
    };

    this.emit({
      type: "debate:completed",
      timestamp: new Date().toISOString(),
      data: { debateId: this.context!.id, outcome, consensusLevel, winningProposalId: winningProposal?.proposalId },
    });

    return result;
  }

  timeBox(durationMs: number): void {
    this.ensureContext();

    this.context!.timeLimitMs = durationMs;

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      if (this.context && this.context.status === "active") {
        this.context.status = "timed_out";
        this.emit({
          type: "debate:timed_out",
          timestamp: new Date().toISOString(),
          data: { debateId: this.context.id },
        });
      }
    }, durationMs);
  }

  earlyTermination(condition?: EarlyTerminationCondition): boolean {
    this.ensureContext();

    if (condition) {
      this.earlyTerminationCondition = condition;
    }

    const cond = this.earlyTerminationCondition;
    if (!cond) return false;

    if (cond.consensusReached) {
      const allVotes = this.getAllVotes();
      const consensusLevel = this.calculateConsensusLevel(allVotes);
      if (consensusLevel >= DEFAULT_PERSONA_MESH_CONFIG.consensusThreshold) {
        return true;
      }
    }

    if (cond.timeExceeded && this.context!.timeLimitMs) {
      const elapsed = Date.now() - new Date(this.context!.startTime).getTime();
      if (elapsed >= this.context!.timeLimitMs) {
        return true;
      }
    }

    if (cond.maxRoundsExceeded && this.rounds.length >= this.maxRounds) {
      return true;
    }

    if (cond.allProposalsRejected) {
      const allVotes = this.getAllVotes();
      const allLow = allVotes.every((v) => v.score < 3);
      if (allLow && allVotes.length > 0) {
        return true;
      }
    }

    if (cond.customCondition && cond.customCondition()) {
      return true;
    }

    return false;
  }

  advancePhase(): DebatePhase {
    this.ensureContext();

    const phaseOrder: DebatePhase[] = [
      DebatePhase.Opening,
      DebatePhase.Proposals,
      DebatePhase.Critiques,
      DebatePhase.Defenses,
      DebatePhase.Voting,
      DebatePhase.Conclusion,
    ];

    const currentIndex = phaseOrder.indexOf(this.context!.phase);
    if (currentIndex >= phaseOrder.length - 1) {
      return this.context!.phase;
    }

    if (this.context!.phase === DebatePhase.Proposals) {
      const currentRound = this.getCurrentRound();
      if (currentRound && currentRound.proposalCount() === 0) {
        throw new Error("Cannot advance from proposals phase without any proposals");
      }
    }

    if (this.context!.phase === DebatePhase.Voting) {
      const currentRound = this.getCurrentRound();
      if (currentRound) {
        currentRound.conclude();
      }

      if (this.context!.currentRoundNumber < this.maxRounds) {
        this.context!.phase = DebatePhase.Proposals;
        this.startNewRound();

        this.emit({
          type: "debate:round_started",
          timestamp: new Date().toISOString(),
          data: { debateId: this.context!.id, roundNumber: this.context!.currentRoundNumber },
        });

        return this.context!.phase;
      }
    }

    const nextPhase = phaseOrder[currentIndex + 1];
    this.context!.phase = nextPhase;

    if (nextPhase === DebatePhase.Proposals && this.rounds.length === 0) {
      this.startNewRound();

      this.emit({
        type: "debate:round_started",
        timestamp: new Date().toISOString(),
        data: { debateId: this.context!.id, roundNumber: this.context!.currentRoundNumber },
      });
    }

    return nextPhase;
  }

  getContext(): DebateContext | null {
    return this.context;
  }

  getCurrentRound(): DebateRound | null {
    if (this.rounds.length === 0) return null;
    return this.rounds[this.rounds.length - 1];
  }

  getRounds(): DebateRound[] {
    return [...this.rounds];
  }

  getPhase(): DebatePhase | null {
    return this.context?.phase ?? null;
  }

  getStatus(): string {
    return this.context?.status ?? "none";
  }

  setMaxRounds(max: number): void {
    this.maxRounds = Math.max(1, max);
  }

  setScoring(scoring: DebateScoring): void {
    this.scoring = scoring;
  }

  getScoring(): DebateScoring {
    return this.scoring;
  }

  reset(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.context = null;
    this.rounds = [];
    this.earlyTerminationCondition = null;
  }

  shareContext(key: string, value: unknown): void {
    if (this.context) {
      this.context.sharedMemory.set(key, value);
    }
  }

  getSharedContext(key: string): unknown {
    return this.context?.sharedMemory.get(key);
  }

  on(event: PersonaMeshEventName, handler: PersonaMeshEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: PersonaMeshEventName, handler: PersonaMeshEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: PersonaMeshEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch {
          // swallow handler errors
        }
      }
    }
  }

  private ensureContext(): void {
    if (!this.context) {
      throw new Error("No active debate context. Call initiate() first.");
    }
  }

  private ensurePhase(expected: DebatePhase): void {
    if (this.context!.phase !== expected) {
      if (this.context!.phase === DebatePhase.Opening && expected === DebatePhase.Proposals) {
        this.context!.phase = DebatePhase.Proposals;
        return;
      }
      throw new Error(`Expected phase ${expected}, but current phase is ${this.context!.phase}`);
    }
  }

  private startNewRound(): DebateRound {
    this.context!.currentRoundNumber++;
    const round = DebateRound.create(this.context!.topic, this.context!.currentRoundNumber);
    this.rounds.push(round);

    this.context!.rounds.push(round.toData());

    return round;
  }

  private getAllProposals(): ProposalData[] {
    const proposals: ProposalData[] = [];
    for (const round of this.rounds) {
      proposals.push(...round.getProposals());
    }
    return proposals;
  }

  private getAllCritiques(): CritiqueData[] {
    const critiques: CritiqueData[] = [];
    for (const round of this.rounds) {
      for (const proposal of round.getProposals()) {
        critiques.push(...round.getCritiquesForProposal(proposal.id));
      }
    }
    return critiques;
  }

  private getAllDefenses(): DefenseData[] {
    const defenses: DefenseData[] = [];
    for (const round of this.rounds) {
      for (const proposal of round.getProposals()) {
        for (const critique of round.getCritiquesForProposal(proposal.id)) {
          defenses.push(...round.getDefensesForCritique(critique.id));
        }
      }
    }
    return defenses;
  }

  private getAllVotes(): VoteData[] {
    const votes: VoteData[] = [];
    for (const round of this.rounds) {
      for (const proposal of round.getProposals()) {
        votes.push(...round.getVotesForProposal(proposal.id));
      }
    }
    return votes;
  }

  private rankProposals(
    proposals: ProposalData[],
    critiques: CritiqueData[],
    defenses: DefenseData[],
    votes: VoteData[]
  ): import("./types.js").RankedProposal[] {
    const ranked = proposals.map((proposal) => {
      const proposalCritiques = critiques.filter((c) => c.proposalId === proposal.id);
      const proposalDefenses = defenses.filter((d) => d.proposalId === proposal.id);
      const proposalVotes = votes.filter((v) => v.proposalId === proposal.id);

      const score = this.scoring.calculateFinalScore(proposal, proposalCritiques, proposalDefenses);

      const voteScore = proposalVotes.length > 0
        ? proposalVotes.reduce((sum, v) => sum + v.score, 0) / proposalVotes.length
        : score;

      const finalScore = score * 0.6 + voteScore * 0.4;

      return {
        proposalId: proposal.id,
        personaId: proposal.personaId,
        content: proposal.content,
        finalScore,
        rank: 0,
      };
    });

    ranked.sort((a, b) => b.finalScore - a.finalScore);

    for (let i = 0; i < ranked.length; i++) {
      ranked[i].rank = i + 1;
    }

    return ranked;
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

  private determineOutcome(consensusLevel: number, ranked: import("./types.js").RankedProposal[]): DebateOutcome {
    if (consensusLevel >= DEFAULT_PERSONA_MESH_CONFIG.consensusThreshold && ranked.length > 0) {
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
        const firstSentence = proposal.content.split(/[.!?]/)[0];
        if (firstSentence && firstSentence.trim().length > 0) {
          insights.push(firstSentence.trim());
        }
      }
    }

    for (const critique of critiques) {
      if (critique.severity === "high") {
        const firstSentence = critique.content.split(/[.!?]/)[0];
        if (firstSentence && firstSentence.trim().length > 0) {
          insights.push(`Critical concern: ${firstSentence.trim()}`);
        }
      }
    }

    return insights.slice(0, 10);
  }

  private extractUnresolvedIssues(critiques: CritiqueData[], defenses: DefenseData[]): string[] {
    const issues: string[] = [];

    const defendedCritiqueIds = new Set(defenses.map((d) => d.critiqueId));

    for (const critique of critiques) {
      if (!defendedCritiqueIds.has(critique.id)) {
        const firstSentence = critique.content.split(/[.!?]/)[0];
        if (firstSentence && firstSentence.trim().length > 0) {
          issues.push(firstSentence.trim());
        }
      } else {
        const relatedDefenses = defenses.filter((d) => d.critiqueId === critique.id);
        for (const defense of relatedDefenses) {
          if (defense.conceded.length > 0) {
            issues.push(...defense.conceded);
          }
        }
      }
    }

    return [...new Set(issues)].slice(0, 10);
  }

  private synthesizeConclusion(
    winningProposal: import("./types.js").RankedProposal | null,
    keyInsights: string[],
    unresolvedIssues: string[]
  ): string {
    const parts: string[] = [];

    if (winningProposal) {
      parts.push(`The leading proposal (score: ${winningProposal.finalScore.toFixed(2)}) suggests: ${winningProposal.content.substring(0, 200)}`);
    }

    if (keyInsights.length > 0) {
      parts.push(`Key insights: ${keyInsights.slice(0, 3).join("; ")}`);
    }

    if (unresolvedIssues.length > 0) {
      parts.push(`Unresolved issues: ${unresolvedIssues.slice(0, 3).join("; ")}`);
    }

    return parts.join(". ");
  }

  private findConsensusPoints(proposals: ProposalData[], votes: VoteData[]): string[] {
    const points: string[] = [];

    const proposalVoteMap = new Map<string, VoteData[]>();
    for (const vote of votes) {
      if (!proposalVoteMap.has(vote.proposalId)) {
        proposalVoteMap.set(vote.proposalId, []);
      }
      proposalVoteMap.get(vote.proposalId)!.push(vote);
    }

    for (const proposal of proposals) {
      const proposalVotes = proposalVoteMap.get(proposal.id) ?? [];
      if (proposalVotes.length >= 2) {
        const avgScore = proposalVotes.reduce((s, v) => s + v.score, 0) / proposalVotes.length;
        if (avgScore >= 7) {
          const firstSentence = proposal.content.split(/[.!?]/)[0];
          if (firstSentence && firstSentence.trim().length > 0) {
            points.push(firstSentence.trim());
          }
        }
      }
    }

    return points;
  }

  private findDisagreementPoints(votes: VoteData[]): string[] {
    const points: string[] = [];

    const proposalVoteMap = new Map<string, VoteData[]>();
    for (const vote of votes) {
      if (!proposalVoteMap.has(vote.proposalId)) {
        proposalVoteMap.set(vote.proposalId, []);
      }
      proposalVoteMap.get(vote.proposalId)!.push(vote);
    }

    for (const [proposalId, proposalVotes] of proposalVoteMap) {
      if (proposalVotes.length >= 2) {
        const scores = proposalVotes.map((v) => v.score);
        const maxDiff = Math.max(...scores) - Math.min(...scores);
        if (maxDiff >= 4) {
          const lowVoters = proposalVotes.filter((v) => v.score < 4);
          const highVoters = proposalVotes.filter((v) => v.score >= 7);
          if (lowVoters.length > 0 && highVoters.length > 0) {
            points.push(`Proposal ${proposalId}: significant disagreement (range: ${Math.min(...scores)}-${Math.max(...scores)})`);
          }
        }
      }
    }

    return points;
  }

  private generateDebateReport(
    topic: string,
    outcome: DebateOutcome,
    winningProposal: import("./types.js").RankedProposal | null,
    consensusLevel: number,
    keyInsights: string[],
    unresolvedIssues: string[],
    roundSummaries: string[]
  ): string {
    const lines: string[] = [];

    lines.push(`DEBATE REPORT: ${topic}`);
    lines.push(`Outcome: ${outcome}`);
    lines.push(`Consensus Level: ${(consensusLevel * 100).toFixed(1)}%`);
    lines.push("");

    if (winningProposal) {
      lines.push(`Winning Proposal (score: ${winningProposal.finalScore.toFixed(2)}):`);
      lines.push(`  ${winningProposal.content.substring(0, 300)}`);
      lines.push("");
    }

    if (keyInsights.length > 0) {
      lines.push("Key Insights:");
      for (const insight of keyInsights) {
        lines.push(`  - ${insight}`);
      }
      lines.push("");
    }

    if (unresolvedIssues.length > 0) {
      lines.push("Unresolved Issues:");
      for (const issue of unresolvedIssues) {
        lines.push(`  - ${issue}`);
      }
      lines.push("");
    }

    if (roundSummaries.length > 0) {
      lines.push("Round Summaries:");
      for (const summary of roundSummaries) {
        lines.push(`  - ${summary}`);
      }
    }

    return lines.join("\n");
  }
}
