import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import type {
  ProposalData,
  CritiqueData,
  DefenseData,
  ScoringCriteria,
  InternalPersonaId,
} from "./types.js";
import { DEFAULT_SCORING_CRITERIA } from "./types.js";

export class DebateScoring {
  private criteria: ScoringCriteria;
  private personaWeights: Map<InternalPersonaId, number>;
  private scoreHistory: Map<string, number[]>;

  constructor(criteria?: Partial<ScoringCriteria>) {
    this.criteria = { ...DEFAULT_SCORING_CRITERIA, ...criteria };
    this.personaWeights = new Map();
    this.scoreHistory = new Map();
  }

  scoreProposal(proposal: ProposalData, criteria?: Partial<ScoringCriteria>): number {
    const effectiveCriteria = { ...this.criteria, ...criteria };

    let score = 0;

    const feasibilityScore = this.assessFeasibility(proposal);
    score += feasibilityScore * effectiveCriteria.feasibility;

    const completenessScore = this.assessCompleteness(proposal);
    score += completenessScore * effectiveCriteria.completeness;

    const efficiencyScore = this.assessEfficiency(proposal);
    score += efficiencyScore * effectiveCriteria.efficiency;

    const riskScore = this.assessRisk(proposal);
    score += (1 - riskScore) * effectiveCriteria.risk;

    const innovationScore = this.assessInnovation(proposal);
    score += innovationScore * effectiveCriteria.innovation;

    score *= proposal.confidence;

    const clampedScore = Math.max(0, Math.min(10, score * 10));

    const history = this.scoreHistory.get(proposal.id) ?? [];
    history.push(clampedScore);
    this.scoreHistory.set(proposal.id, history);

    return clampedScore;
  }

  scoreCritique(critique: CritiqueData, targetProposal: ProposalData): number {
    let score = 0;

    const relevanceScore = this.assessCritiqueRelevance(critique, targetProposal);
    score += relevanceScore * 0.3;

    const depthScore = this.assessCritiqueDepth(critique);
    score += depthScore * 0.3;

    const evidenceScore = this.assessCritiqueEvidence(critique);
    score += evidenceScore * 0.2;

    const severityMultiplier = this.getSeverityMultiplier(critique.severity);
    score *= severityMultiplier;

    const lengthBonus = Math.min(critique.content.length / 200, 1.0) * 0.2;
    score += lengthBonus;

    return Math.max(0, Math.min(10, score * 10));
  }

  scoreDefense(defense: DefenseData, critique: CritiqueData): number {
    let score = 0;

    const rebuttalRatio = defense.rebutted.length > 0 || critique.addressedPoints.length > 0
      ? defense.rebutted.length / Math.max(critique.addressedPoints.length, 1)
      : 0;
    score += Math.min(rebuttalRatio, 1.0) * 0.3;

    const concessionPenalty = defense.conceded.length * 0.1;
    score -= concessionPenalty;

    const defenseDepth = Math.min(defense.content.length / 150, 1.0);
    score += defenseDepth * 0.3;

    const specificity = this.countSpecificClaims(defense.content) * 0.05;
    score += Math.min(specificity, 0.4);

    return Math.max(0, Math.min(10, (score + 0.5) * 10));
  }

  calculateFinalScore(
    proposal: ProposalData,
    critiques: CritiqueData[],
    defenses: DefenseData[]
  ): number {
    const baseScore = this.scoreProposal(proposal);

    if (critiques.length === 0) {
      return baseScore * 0.9;
    }

    let critiqueImpact = 0;
    for (const critique of critiques) {
      const critiqueScore = this.scoreCritique(critique, proposal);
      const hasDefense = defenses.some((d) => d.critiqueId === critique.id);

      if (hasDefense) {
        const defense = defenses.find((d) => d.critiqueId === critique.id)!;
        const defenseScore = this.scoreDefense(defense, critique);
        const netImpact = (critiqueScore - defenseScore) / 10;
        critiqueImpact += netImpact * 0.5;
      } else {
        critiqueImpact += (critiqueScore / 10) * 0.3;
      }
    }

    critiqueImpact /= critiques.length;

    const finalScore = baseScore - critiqueImpact * baseScore;

    return Math.max(0, Math.min(10, finalScore));
  }

  weightByPersona(personaId: InternalPersonaId, score: number): number {
    const weight = this.personaWeights.get(personaId) ?? 1.0;
    return score * weight;
  }

  setPersonaWeight(personaId: InternalPersonaId, weight: number): void {
    this.personaWeights.set(personaId, Math.max(0.1, Math.min(2.0, weight)));
  }

  getPersonaWeight(personaId: InternalPersonaId): number {
    return this.personaWeights.get(personaId) ?? 1.0;
  }

  setCriteria(criteria: Partial<ScoringCriteria>): void {
    this.criteria = { ...this.criteria, ...criteria };
  }

  getCriteria(): ScoringCriteria {
    return { ...this.criteria };
  }

  getScoreHistory(proposalId: string): number[] {
    return this.scoreHistory.get(proposalId) ?? [];
  }

  clearHistory(): void {
    this.scoreHistory.clear();
  }

  private assessFeasibility(proposal: ProposalData): number {
    let score = 0.5;

    const content = proposal.content.toLowerCase();

    const feasibilityMarkers = ["can", "will", "implement", "build", "create", "achieve", "possible", "practical"];
    const infeasibilityMarkers = ["impossible", "cannot", "unrealistic", "infeasible", "never"];

    for (const marker of feasibilityMarkers) {
      if (content.includes(marker)) score += 0.05;
    }
    for (const marker of infeasibilityMarkers) {
      if (content.includes(marker)) score -= 0.1;
    }

    if (proposal.assumptions.length > 0) {
      score += Math.min(proposal.assumptions.length * 0.05, 0.15);
    }

    return Math.max(0, Math.min(1, score));
  }

  private assessCompleteness(proposal: ProposalData): number {
    let score = 0.3;

    if (proposal.content.length > 100) score += 0.1;
    if (proposal.content.length > 300) score += 0.1;
    if (proposal.content.length > 500) score += 0.1;

    if (proposal.supportingEvidence.length > 0) {
      score += Math.min(proposal.supportingEvidence.length * 0.1, 0.2);
    }

    if (proposal.assumptions.length > 0) {
      score += Math.min(proposal.assumptions.length * 0.05, 0.1);
    }

    const content = proposal.content.toLowerCase();
    const completenessMarkers = ["step", "first", "then", "finally", "additionally", "moreover", "furthermore"];
    for (const marker of completenessMarkers) {
      if (content.includes(marker)) score += 0.03;
    }

    return Math.max(0, Math.min(1, score));
  }

  private assessEfficiency(proposal: ProposalData): number {
    let score = 0.5;

    const content = proposal.content.toLowerCase();
    const efficiencyMarkers = ["efficient", "optimize", "minimize", "fast", "quick", "streamline", "simplify"];
    const inefficiencyMarkers = ["complex", "complicated", "overhead", "slow", "expensive"];

    for (const marker of efficiencyMarkers) {
      if (content.includes(marker)) score += 0.05;
    }
    for (const marker of inefficiencyMarkers) {
      if (content.includes(marker)) score -= 0.05;
    }

    const wordCount = proposal.content.split(/\s+/).length;
    if (wordCount < 50) score += 0.1;
    else if (wordCount < 150) score += 0.05;
    else if (wordCount > 500) score -= 0.05;

    return Math.max(0, Math.min(1, score));
  }

  private assessRisk(proposal: ProposalData): number {
    let risk = 0.2;

    const content = proposal.content.toLowerCase();
    const riskMarkers = ["risk", "danger", "potential failure", "might fail", "uncertain", "untested", "experimental"];
    const safetyMarkers = ["safe", "tested", "proven", "reliable", "stable", "established"];

    for (const marker of riskMarkers) {
      if (content.includes(marker)) risk += 0.1;
    }
    for (const marker of safetyMarkers) {
      if (content.includes(marker)) risk -= 0.1;
    }

    if (proposal.assumptions.length > 3) {
      risk += 0.1;
    }

    if (proposal.confidence < 0.5) {
      risk += 0.15;
    }

    return Math.max(0, Math.min(1, risk));
  }

  private assessInnovation(proposal: ProposalData): number {
    let score = 0.3;

    const content = proposal.content.toLowerCase();
    const innovationMarkers = ["novel", "innovative", "creative", "new approach", "unique", "unconventional", "breakthrough"];
    const conventionalMarkers = ["standard", "traditional", "conventional", "usual", "normal", "typical"];

    for (const marker of innovationMarkers) {
      if (content.includes(marker)) score += 0.1;
    }
    for (const marker of conventionalMarkers) {
      if (content.includes(marker)) score -= 0.05;
    }

    if (proposal.confidence > 0.7) {
      score += 0.05;
    }

    return Math.max(0, Math.min(1, score));
  }

  private assessCritiqueRelevance(critique: CritiqueData, proposal: ProposalData): number {
    let relevance = 0.3;

    if (critique.addressedPoints.length > 0) {
      const proposalPoints = proposal.content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      const matchedPoints = critique.addressedPoints.filter((point) => {
        const pointLower = point.toLowerCase();
        return proposal.content.toLowerCase().includes(pointLower) ||
          proposalPoints.some((pp) => this.textSimilarity(pp, point) > 0.3);
      });
      relevance += Math.min(matchedPoints.length / Math.max(critique.addressedPoints.length, 1), 1.0) * 0.5;
    }

    const proposalWords = new Set(proposal.content.toLowerCase().split(/\s+/));
    const critiqueWords = new Set(critique.content.toLowerCase().split(/\s+/));
    let overlap = 0;
    for (const word of critiqueWords) {
      if (proposalWords.has(word)) overlap++;
    }
    relevance += Math.min(overlap / Math.max(critiqueWords.size, 1), 1.0) * 0.2;

    return Math.max(0, Math.min(1, relevance));
  }

  private assessCritiqueDepth(critique: CritiqueData): number {
    let depth = 0.2;

    if (critique.content.length > 100) depth += 0.2;
    if (critique.content.length > 300) depth += 0.2;

    depth += Math.min(this.countSpecificClaims(critique.content) * 0.1, 0.3);

    if (critique.counterEvidence.length > 0) {
      depth += Math.min(critique.counterEvidence.length * 0.1, 0.1);
    }

    return Math.max(0, Math.min(1, depth));
  }

  private assessCritiqueEvidence(critique: CritiqueData): number {
    let evidence = 0.1;

    evidence += Math.min(critique.counterEvidence.length * 0.2, 0.5);

    const content = critique.content.toLowerCase();
    const evidenceMarkers = ["evidence", "data", "research", "study", "proven", "shown", "demonstrated", "according to"];
    for (const marker of evidenceMarkers) {
      if (content.includes(marker)) evidence += 0.1;
    }

    return Math.max(0, Math.min(1, evidence));
  }

  private getSeverityMultiplier(severity: "low" | "medium" | "high"): number {
    switch (severity) {
      case "low": return 0.7;
      case "medium": return 1.0;
      case "high": return 1.3;
    }
  }

  private countSpecificClaims(text: string): number {
    const claimPatterns = [
      /\d+%/, /\d+\s*(times|instances|cases)/, /\$\d+/,
      /will\s+(reduce|increase|improve|decrease)/,
      /can\s+(save|cost|generate|eliminate)/,
      /leads\s+to/, /results\s+in/, /causes/,
    ];

    let count = 0;
    for (const pattern of claimPatterns) {
      const matches = text.match(pattern);
      if (matches) count += matches.length;
    }
    return count;
  }

  private textSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    return union > 0 ? intersection / union : 0;
  }
}
