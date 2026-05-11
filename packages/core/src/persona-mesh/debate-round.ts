import { generateId } from "@paracosm/shared";
import type {
  InternalPersonaId,
  ProposalData,
  CritiqueData,
  DefenseData,
  VoteData,
  DebateRoundData,
} from "./types.js";

export class DebateRound {
  private roundNumber: number;
  private topic: string;
  private proposals: Map<string, ProposalData>;
  private critiques: Map<string, CritiqueData>;
  private defenses: Map<string, DefenseData>;
  private votes: Map<string, VoteData[]>;
  private proposalCritiqueIndex: Map<string, string[]>;
  private critiqueDefenseIndex: Map<string, string[]>;
  private startTime: string;
  private endTime: string | null;
  private summary: string | null;

  private constructor(roundNumber: number, topic: string) {
    this.roundNumber = roundNumber;
    this.topic = topic;
    this.proposals = new Map();
    this.critiques = new Map();
    this.defenses = new Map();
    this.votes = new Map();
    this.proposalCritiqueIndex = new Map();
    this.critiqueDefenseIndex = new Map();
    this.startTime = new Date().toISOString();
    this.endTime = null;
    this.summary = null;
  }

  static create(topic: string, roundNumber: number = 1): DebateRound {
    return new DebateRound(roundNumber, topic);
  }

  addProposal(personaId: InternalPersonaId, content: string, confidence: number = 0.5, supportingEvidence: string[] = [], assumptions: string[] = []): string {
    const id = generateId();
    const proposal: ProposalData = {
      id,
      personaId,
      content,
      confidence: Math.max(0, Math.min(1, confidence)),
      supportingEvidence: [...supportingEvidence],
      assumptions: [...assumptions],
      timestamp: new Date().toISOString(),
    };

    this.proposals.set(id, proposal);
    this.proposalCritiqueIndex.set(id, []);
    this.votes.set(id, []);

    return id;
  }

  addCritique(proposalId: string, personaId: InternalPersonaId, content: string, severity: "low" | "medium" | "high" = "medium", addressedPoints: string[] = [], counterEvidence: string[] = []): string {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    const id = generateId();
    const critique: CritiqueData = {
      id,
      personaId,
      proposalId,
      content,
      severity,
      addressedPoints: [...addressedPoints],
      counterEvidence: [...counterEvidence],
      timestamp: new Date().toISOString(),
    };

    this.critiques.set(id, critique);

    const critiqueIds = this.proposalCritiqueIndex.get(proposalId) ?? [];
    critiqueIds.push(id);
    this.proposalCritiqueIndex.set(proposalId, critiqueIds);
    this.critiqueDefenseIndex.set(id, []);

    return id;
  }

  addDefense(proposalId: string, critiqueId: string, personaId: InternalPersonaId, content: string, conceded: string[] = [], rebutted: string[] = []): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    const critique = this.critiques.get(critiqueId);
    if (!critique) {
      throw new Error(`Critique ${critiqueId} not found`);
    }

    if (critique.proposalId !== proposalId) {
      throw new Error(`Critique ${critiqueId} does not belong to proposal ${proposalId}`);
    }

    const id = generateId();
    const defense: DefenseData = {
      id,
      personaId,
      proposalId,
      critiqueId,
      content,
      conceded: [...conceded],
      rebutted: [...rebutted],
      timestamp: new Date().toISOString(),
    };

    this.defenses.set(id, defense);

    const defenseIds = this.critiqueDefenseIndex.get(critiqueId) ?? [];
    defenseIds.push(id);
    this.critiqueDefenseIndex.set(critiqueId, defenseIds);
  }

  addVote(proposalId: string, personaId: InternalPersonaId, score: number, reasoning: string): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    const clampedScore = Math.max(0, Math.min(10, score));
    const vote: VoteData = {
      personaId,
      proposalId,
      score: clampedScore,
      reasoning,
      timestamp: new Date().toISOString(),
    };

    const votes = this.votes.get(proposalId) ?? [];
    const existingIndex = votes.findIndex((v) => v.personaId === personaId);
    if (existingIndex >= 0) {
      votes[existingIndex] = vote;
    } else {
      votes.push(vote);
    }
    this.votes.set(proposalId, votes);
  }

  score(proposalId: string): number {
    const votes = this.votes.get(proposalId);
    if (!votes || votes.length === 0) return 0;

    const total = votes.reduce((sum, v) => sum + v.score, 0);
    return total / votes.length;
  }

  getProposal(id: string): ProposalData | undefined {
    return this.proposals.get(id);
  }

  getCritique(id: string): CritiqueData | undefined {
    return this.critiques.get(id);
  }

  getDefense(id: string): DefenseData | undefined {
    return this.defenses.get(id);
  }

  getProposals(): ProposalData[] {
    return Array.from(this.proposals.values());
  }

  getCritiquesForProposal(proposalId: string): CritiqueData[] {
    const critiqueIds = this.proposalCritiqueIndex.get(proposalId) ?? [];
    return critiqueIds
      .map((id) => this.critiques.get(id))
      .filter((c): c is CritiqueData => c !== undefined);
  }

  getDefensesForCritique(critiqueId: string): DefenseData[] {
    const defenseIds = this.critiqueDefenseIndex.get(critiqueId) ?? [];
    return defenseIds
      .map((id) => this.defenses.get(id))
      .filter((d): d is DefenseData => d !== undefined);
  }

  getVotesForProposal(proposalId: string): VoteData[] {
    return this.votes.get(proposalId) ?? [];
  }

  getRoundNumber(): number {
    return this.roundNumber;
  }

  getTopic(): string {
    return this.topic;
  }

  getStartTime(): string {
    return this.startTime;
  }

  setEndTime(time: string): void {
    this.endTime = time;
  }

  getEndTime(): string | null {
    return this.endTime;
  }

  setSummary(summary: string): void {
    this.summary = summary;
  }

  getSummary(): string | null {
    return this.summary;
  }

  hasPersonaProposed(personaId: InternalPersonaId): boolean {
    for (const proposal of this.proposals.values()) {
      if (proposal.personaId === personaId) return true;
    }
    return false;
  }

  hasPersonaVoted(personaId: InternalPersonaId, proposalId: string): boolean {
    const votes = this.votes.get(proposalId) ?? [];
    return votes.some((v) => v.personaId === personaId);
  }

  proposalCount(): number {
    return this.proposals.size;
  }

  critiqueCount(): number {
    return this.critiques.size;
  }

  defenseCount(): number {
    return this.defenses.size;
  }

  conclude(): void {
    this.endTime = new Date().toISOString();
  }

  isConcluded(): boolean {
    return this.endTime !== null;
  }

  toData(): DebateRoundData {
    return {
      roundNumber: this.roundNumber,
      proposals: Array.from(this.proposals.values()),
      critiques: Array.from(this.critiques.values()),
      defenses: Array.from(this.defenses.values()),
      votes: Array.from(this.votes.values()).flat(),
      summary: this.summary,
    };
  }

  serialize(): Record<string, unknown> {
    return {
      roundNumber: this.roundNumber,
      topic: this.topic,
      proposals: Array.from(this.proposals.values()).map((p) => ({ ...p })),
      critiques: Array.from(this.critiques.values()).map((c) => ({ ...c })),
      defenses: Array.from(this.defenses.values()).map((d) => ({ ...d })),
      votes: Array.from(this.votes.values()).flat().map((v) => ({ ...v })),
      startTime: this.startTime,
      endTime: this.endTime,
      summary: this.summary,
    };
  }

  static deserialize(data: Record<string, unknown>): DebateRound {
    const round = new DebateRound(
      data.roundNumber as number,
      data.topic as string
    );

    round.startTime = (data.startTime as string) ?? new Date().toISOString();
    round.endTime = (data.endTime as string) ?? null;
    round.summary = (data.summary as string) ?? null;

    const proposals = (data.proposals as ProposalData[]) ?? [];
    for (const p of proposals) {
      round.proposals.set(p.id, { ...p });
      round.proposalCritiqueIndex.set(p.id, []);
      round.votes.set(p.id, []);
    }

    const critiques = (data.critiques as CritiqueData[]) ?? [];
    for (const c of critiques) {
      round.critiques.set(c.id, { ...c });
      const ids = round.proposalCritiqueIndex.get(c.proposalId) ?? [];
      ids.push(c.id);
      round.proposalCritiqueIndex.set(c.proposalId, ids);
      round.critiqueDefenseIndex.set(c.id, []);
    }

    const defenses = (data.defenses as DefenseData[]) ?? [];
    for (const d of defenses) {
      round.defenses.set(d.id, { ...d });
      const ids = round.critiqueDefenseIndex.get(d.critiqueId) ?? [];
      ids.push(d.id);
      round.critiqueDefenseIndex.set(d.critiqueId, ids);
    }

    const votes = (data.votes as VoteData[]) ?? [];
    for (const v of votes) {
      const voteList = round.votes.get(v.proposalId) ?? [];
      voteList.push({ ...v });
      round.votes.set(v.proposalId, voteList);
    }

    return round;
  }
}
