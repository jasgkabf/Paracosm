import { PersonaRole } from "@paracosm/shared";
import { Persona } from "./persona.js";
import type { PersonaRegistry } from "./persona-registry.js";
import type {
  InternalPersonaId,
  PersonaPerformance,
  AdaptationEntry,
  DebateResultInternal,
  PersonaMeshEvent,
  PersonaMeshEventName,
  PersonaMeshEventHandler,
} from "./types.js";

const DEFAULT_PERFORMANCE: PersonaPerformance = {
  personaId: "",
  debatesParticipated: 0,
  proposalsMade: 0,
  proposalsAccepted: 0,
  critiquesMade: 0,
  critiquesSustained: 0,
  defensesMade: 0,
  defensesSuccessful: 0,
  averageScore: 0,
  winRate: 0,
  contributionScore: 0,
  lastActiveAt: null,
  adaptationHistory: [],
};

export class PersonaLearning {
  private registry: PersonaRegistry | null;
  private performances: Map<InternalPersonaId, PersonaPerformance>;
  private userPersonaPreferences: Map<string, Map<InternalPersonaId, number>>;
  private promptAdaptations: Map<InternalPersonaId, string[]>;
  private weightAdjustments: Map<InternalPersonaId, number>;
  private eventHandlers: Map<PersonaMeshEventName, Set<PersonaMeshEventHandler>>;
  private learningRate: number;

  constructor(learningRate: number = 0.1) {
    this.registry = null;
    this.performances = new Map();
    this.userPersonaPreferences = new Map();
    this.promptAdaptations = new Map();
    this.weightAdjustments = new Map();
    this.eventHandlers = new Map();
    this.learningRate = Math.max(0.01, Math.min(0.5, learningRate));
  }

  setRegistry(registry: PersonaRegistry): void {
    this.registry = registry;
  }

  learnFromResult(personaId: InternalPersonaId, result: DebateResultInternal, success: boolean): void {
    const performance = this.getOrCreatePerformance(personaId);

    performance.debatesParticipated++;
    performance.lastActiveAt = new Date().toISOString();

    if (success) {
      performance.winRate = (performance.winRate * (performance.debatesParticipated - 1) + 1) / performance.debatesParticipated;
    } else {
      performance.winRate = (performance.winRate * (performance.debatesParticipated - 1)) / performance.debatesParticipated;
    }

    const isWinner = result.winningProposalId !== null;
    const rankedProposal = result.rankedProposals.find((rp) => rp.personaId === personaId);

    if (rankedProposal) {
      performance.proposalsMade++;
      if (rankedProposal.rank === 1) {
        performance.proposalsAccepted++;
      }

      const oldAvg = performance.averageScore;
      performance.averageScore = (oldAvg * (performance.proposalsMade - 1) + rankedProposal.finalScore) / performance.proposalsMade;
    }

    performance.contributionScore = this.calculateContributionScore(performance);

    this.performances.set(personaId, performance);

    if (success) {
      this.reinforceBehavior(personaId, result);
    } else {
      this.adjustBehavior(personaId, result);
    }

    this.emit({
      type: "learning:adapted",
      timestamp: new Date().toISOString(),
      data: { personaId, success, winRate: performance.winRate, contributionScore: performance.contributionScore },
    });
  }

  adaptPrompt(personaId: InternalPersonaId, feedback: string): string {
    if (!this.registry) return "";

    const persona = this.registry.get(personaId);
    if (!persona) return "";

    const currentPrompt = persona.getSystemPrompt();
    const adaptations = this.promptAdaptations.get(personaId) ?? [];

    let adaptedPrompt = currentPrompt;

    const feedbackLower = feedback.toLowerCase();

    if (feedbackLower.includes("more detail") || feedbackLower.includes("more specific")) {
      const addition = " Provide detailed, specific responses with concrete examples and evidence.";
      if (!adaptedPrompt.includes(addition)) {
        adaptedPrompt += addition;
        adaptations.push(addition);
      }
    }

    if (feedbackLower.includes("too verbose") || feedbackLower.includes("too long") || feedbackLower.includes("concise")) {
      const addition = " Keep responses concise and focused. Avoid unnecessary elaboration.";
      if (!adaptedPrompt.includes(addition)) {
        adaptedPrompt += addition;
        adaptations.push(addition);
      }
    }

    if (feedbackLower.includes("more creative") || feedbackLower.includes("think outside")) {
      const addition = " Explore unconventional approaches and creative solutions. Consider lateral thinking strategies.";
      if (!adaptedPrompt.includes(addition)) {
        adaptedPrompt += addition;
        adaptations.push(addition);
      }
    }

    if (feedbackLower.includes("more practical") || feedbackLower.includes("actionable")) {
      const addition = " Focus on practical, actionable recommendations that can be immediately implemented.";
      if (!adaptedPrompt.includes(addition)) {
        adaptedPrompt += addition;
        adaptations.push(addition);
      }
    }

    if (feedbackLower.includes("consider risks") || feedbackLower.includes("risk assessment")) {
      const addition = " Always consider potential risks, edge cases, and failure modes in your analysis.";
      if (!adaptedPrompt.includes(addition)) {
        adaptedPrompt += addition;
        adaptations.push(addition);
      }
    }

    if (feedbackLower.includes("better structure") || feedbackLower.includes("organize")) {
      const addition = " Structure your responses with clear sections, numbered points, and logical flow.";
      if (!adaptedPrompt.includes(addition)) {
        adaptedPrompt += addition;
        adaptations.push(addition);
      }
    }

    this.promptAdaptations.set(personaId, adaptations);

    const performance = this.getOrCreatePerformance(personaId);
    performance.adaptationHistory.push({
      timestamp: new Date().toISOString(),
      type: "prompt",
      description: `Adapted prompt based on feedback: ${feedback.substring(0, 100)}`,
      before: currentPrompt.substring(0, 100),
      after: adaptedPrompt.substring(0, 100),
      outcome: "neutral",
    });
    this.performances.set(personaId, performance);

    return adaptedPrompt;
  }

  adjustWeights(personaId: InternalPersonaId, performance: PersonaPerformance): void {
    const currentWeight = this.weightAdjustments.get(personaId) ?? 1.0;

    const contributionFactor = performance.contributionScore / 10;
    const winFactor = performance.winRate;
    const scoreFactor = performance.averageScore / 10;

    const targetWeight = (contributionFactor * 0.4 + winFactor * 0.3 + scoreFactor * 0.3) * 2.0;

    const newWeight = currentWeight + this.learningRate * (targetWeight - currentWeight);
    const clampedWeight = Math.max(0.1, Math.min(2.0, newWeight));

    this.weightAdjustments.set(personaId, clampedWeight);

    if (this.registry) {
      const persona = this.registry.get(personaId);
      if (persona) {
        const updated = persona.withWeight(clampedWeight);
        this.registry.hotReload(updated);
      }
    }

    const perf = this.getOrCreatePerformance(personaId);
    perf.adaptationHistory.push({
      timestamp: new Date().toISOString(),
      type: "weight",
      description: `Adjusted weight from ${currentWeight.toFixed(3)} to ${clampedWeight.toFixed(3)}`,
      before: currentWeight.toFixed(3),
      after: clampedWeight.toFixed(3),
      outcome: clampedWeight > currentWeight ? "positive" : clampedWeight < currentWeight ? "negative" : "neutral",
    });
    this.performances.set(personaId, perf);
  }

  trackPerformance(personaId: InternalPersonaId): PersonaPerformance {
    return this.getOrCreatePerformance(personaId);
  }

  personalize(userId: string, personaId: InternalPersonaId): Persona {
    if (!this.registry) {
      throw new Error("Registry not set");
    }

    const persona = this.registry.get(personaId);
    if (!persona) {
      throw new Error(`Persona ${personaId} not found`);
    }

    const userPrefs = this.userPersonaPreferences.get(userId);
    let personalized = persona;

    if (userPrefs && userPrefs.has(personaId)) {
      const preferenceScore = userPrefs.get(personaId)!;
      const adjustedWeight = Math.max(0.1, Math.min(2.0, persona.getWeight() + preferenceScore * 0.2));
      personalized = personalized.withWeight(adjustedWeight);
    }

    const performance = this.performances.get(personaId);
    if (performance && performance.adaptationHistory.length > 0) {
      const promptAdaptations = this.promptAdaptations.get(personaId) ?? [];
      if (promptAdaptations.length > 0) {
        const adaptedPrompt = persona.getSystemPrompt();
        personalized = personalized.withSystemPrompt(adaptedPrompt);
      }
    }

    return personalized;
  }

  recordUserPreference(userId: string, personaId: InternalPersonaId, score: number): void {
    if (!this.userPersonaPreferences.has(userId)) {
      this.userPersonaPreferences.set(userId, new Map());
    }
    const prefs = this.userPersonaPreferences.get(userId)!;
    prefs.set(personaId, Math.max(-1, Math.min(1, score)));
  }

  getUserPreferences(userId: string): Map<InternalPersonaId, number> {
    return this.userPersonaPreferences.get(userId) ?? new Map();
  }

  getTopPerformers(count: number = 5): PersonaPerformance[] {
    const all = Array.from(this.performances.values());
    all.sort((a, b) => b.contributionScore - a.contributionScore);
    return all.slice(0, count);
  }

  getWeightAdjustment(personaId: InternalPersonaId): number {
    return this.weightAdjustments.get(personaId) ?? 1.0;
  }

  getPromptAdaptations(personaId: InternalPersonaId): string[] {
    return this.promptAdaptations.get(personaId) ?? [];
  }

  setLearningRate(rate: number): void {
    this.learningRate = Math.max(0.01, Math.min(0.5, rate));
  }

  getLearningRate(): number {
    return this.learningRate;
  }

  resetPersona(personaId: InternalPersonaId): void {
    this.performances.delete(personaId);
    this.promptAdaptations.delete(personaId);
    this.weightAdjustments.delete(personaId);
  }

  resetAll(): void {
    this.performances.clear();
    this.userPersonaPreferences.clear();
    this.promptAdaptations.clear();
    this.weightAdjustments.clear();
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

  private getOrCreatePerformance(personaId: InternalPersonaId): PersonaPerformance {
    if (!this.performances.has(personaId)) {
      this.performances.set(personaId, { ...DEFAULT_PERFORMANCE, personaId });
    }
    return this.performances.get(personaId)!;
  }

  private calculateContributionScore(performance: PersonaPerformance): number {
    const proposalScore = performance.proposalsMade > 0
      ? (performance.proposalsAccepted / performance.proposalsMade) * 4
      : 0;

    const winScore = performance.winRate * 3;

    const avgScore = performance.averageScore * 0.3;

    return Math.min(10, proposalScore + winScore + avgScore);
  }

  private reinforceBehavior(personaId: InternalPersonaId, result: DebateResultInternal): void {
    const performance = this.getOrCreatePerformance(personaId);
    this.adjustWeights(personaId, performance);

    const rankedProposal = result.rankedProposals.find((rp) => rp.personaId === personaId);
    if (rankedProposal && rankedProposal.rank === 1) {
      const currentWeight = this.weightAdjustments.get(personaId) ?? 1.0;
      const boosted = Math.min(2.0, currentWeight + this.learningRate * 0.1);
      this.weightAdjustments.set(personaId, boosted);
    }
  }

  private adjustBehavior(personaId: InternalPersonaId, result: DebateResultInternal): void {
    const performance = this.getOrCreatePerformance(personaId);
    this.adjustWeights(personaId, performance);

    const rankedProposal = result.rankedProposals.find((rp) => rp.personaId === personaId);
    if (rankedProposal && rankedProposal.rank > 2) {
      const currentWeight = this.weightAdjustments.get(personaId) ?? 1.0;
      const reduced = Math.max(0.1, currentWeight - this.learningRate * 0.05);
      this.weightAdjustments.set(personaId, reduced);
    }

    if (result.unresolvedIssues.length > 0 && performance.proposalsMade > 0) {
      const adaptationHint = " Consider addressing counterarguments more thoroughly and providing stronger evidence.";
      const adaptations = this.promptAdaptations.get(personaId) ?? [];
      if (!adaptations.includes(adaptationHint)) {
        adaptations.push(adaptationHint);
        this.promptAdaptations.set(personaId, adaptations);
      }
    }
  }
}
