import type { Persona, PersonaCombination, PersonaRole } from '@paracosm/shared';
import { generateId, createLogger } from '@paracosm/shared';
import { PERSONA_SYNERGY_WEIGHTS } from '@paracosm/shared';

const logger = createLogger('PersonaCombiner');

export class PersonaCombiner {
  private combinations: Map<string, PersonaCombination> = new Map();
  private performanceHistory: Map<string, Array<{ timestamp: Date; score: number }>> = new Map();

  combine(personas: Persona[], taskType: string): PersonaCombination {
    const id = generateId();
    const personaIds = personas.map((p) => p.id);
    const synergyScore = this.computeSynergy(personas);
    const key = personaIds.sort().join('+');
    const historicalPerformance = this.getHistoricalPerformance(key);
    const combination: PersonaCombination = {
      id,
      personaIds,
      synergyScore,
      taskType,
      historicalPerformance,
      metadata: { createdAt: new Date().toISOString() },
    };
    this.combinations.set(id, combination);
    logger.info(`Created persona combination for task: ${taskType}`, { synergyScore, personaCount: personas.length });
    return combination;
  }

  private computeSynergy(personas: Persona[]): number {
    if (personas.length < 2) return 0.5;
    const roles = new Set(personas.map((p) => p.config.role));
    const complementaryScore = this.computeComplementarity(personas);
    const diversityScore = roles.size / personas.length;
    const performanceScore = this.computeAveragePerformance(personas);
    const synergy =
      PERSONA_SYNERGY_WEIGHTS.complementary * complementaryScore +
      PERSONA_SYNERGY_WEIGHTS.diversity * diversityScore +
      PERSONA_SYNERGY_WEIGHTS.historicalPerformance * performanceScore +
      PERSONA_SYNERGY_WEIGHTS.taskRelevance * 0.5;
    return Math.min(Math.max(synergy, 0), 1);
  }

  private computeComplementarity(personas: Persona[]): number {
    const complementaryPairs: Array<[PersonaRole, PersonaRole]> = [
      ['architect', 'executor'],
      ['architect', 'critic'],
      ['dreamer', 'critic'],
      ['dreamer', 'executor'],
      ['curator', 'architect'],
      ['explorer', 'analyst'],
      ['optimizer', 'innovator'],
      ['guardian', 'executor'],
    ];
    const roles = personas.map((p) => p.config.role);
    let complementCount = 0;
    let totalPairs = 0;
    for (let i = 0; i < roles.length; i++) {
      for (let j = i + 1; j < roles.length; j++) {
        totalPairs++;
        const isComplementary = complementaryPairs.some(
          ([a, b]) => (roles[i] === a && roles[j] === b) || (roles[i] === b && roles[j] === a),
        );
        if (isComplementary) complementCount++;
      }
    }
    return totalPairs > 0 ? complementCount / totalPairs : 0.5;
  }

  private computeAveragePerformance(personas: Persona[]): number {
    const activePersonas = personas.filter((p) => p.state.invocationCount > 0);
    if (activePersonas.length === 0) return 0.5;
    const totalSuccessRate = activePersonas.reduce((sum, p) => sum + p.state.successRate, 0);
    return totalSuccessRate / activePersonas.length;
  }

  private getHistoricalPerformance(combinationKey: string): number {
    const history = this.performanceHistory.get(combinationKey);
    if (!history || history.length === 0) return 0.5;
    const recent = history.slice(-10);
    return recent.reduce((sum, h) => sum + h.score, 0) / recent.length;
  }

  recordPerformance(combinationId: string, score: number): void {
    const combination = this.combinations.get(combinationId);
    if (!combination) return;
    const key = combination.personaIds.sort().join('+');
    const history = this.performanceHistory.get(key) ?? [];
    history.push({ timestamp: new Date(), score });
    this.performanceHistory.set(key, history);
    combination.historicalPerformance = this.getHistoricalPerformance(key);
  }

  findBestCombination(taskType: string, availablePersonas: Persona[], maxSize: number = 5): PersonaCombination | null {
    let bestCombination: PersonaCombination | null = null;
    let bestScore = -1;
    for (const existing of this.combinations.values()) {
      if (existing.taskType === taskType && existing.personaIds.length <= maxSize) {
        const allAvailable = existing.personaIds.every((id) => availablePersonas.some((p) => p.id === id));
        if (allAvailable && existing.synergyScore > bestScore) {
          bestScore = existing.synergyScore;
          bestCombination = existing;
        }
      }
    }
    if (!bestCombination && availablePersonas.length >= 2) {
      const subset = availablePersonas.slice(0, Math.min(maxSize, availablePersonas.length));
      bestCombination = this.combine(subset, taskType);
    }
    return bestCombination;
  }

  getCombination(id: string): PersonaCombination | undefined {
    return this.combinations.get(id);
  }

  getAllCombinations(): PersonaCombination[] {
    return Array.from(this.combinations.values());
  }

  clear(): void {
    this.combinations.clear();
    this.performanceHistory.clear();
  }
}
