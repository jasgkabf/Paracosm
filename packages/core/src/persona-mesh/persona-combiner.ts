import { ok, err } from "@paracosm/shared";
import type { Result } from "@paracosm/shared";
import { generateId } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import { Persona } from "./persona.js";
import type { PersonaRegistry } from "./persona-registry.js";
import type {
  InternalPersonaId,
  PersonaCombinationInternal,
  PersonaActivationInternal,
  CombinationStrategy,
  PersonaMeshEvent,
  PersonaMeshEventName,
  PersonaMeshEventHandler,
} from "./types.js";
import { DEFAULT_PERSONA_MESH_CONFIG } from "./types.js";
import { PersonaState } from "@paracosm/shared";

const STRATEGY_PERSONA_COUNTS: Record<CombinationStrategy, { min: number; max: number }> = {
  minimal: { min: 1, max: 2 },
  balanced: { min: 2, max: 4 },
  comprehensive: { min: 3, max: 5 },
};

export class PersonaCombiner {
  private registry: PersonaRegistry | null;
  private combinations: Map<string, PersonaCombinationInternal>;
  private activeCombination: PersonaCombinationInternal | null;
  private eventHandlers: Map<PersonaMeshEventName, Set<PersonaMeshEventHandler>>;

  constructor() {
    this.registry = null;
    this.combinations = new Map();
    this.activeCombination = null;
    this.eventHandlers = new Map();
  }

  setRegistry(registry: PersonaRegistry): void {
    this.registry = registry;
  }

  combine(
    personaIds: InternalPersonaId[],
    taskType: string,
    strategy: CombinationStrategy = "balanced"
  ): Result<PersonaCombinationInternal, ValidationError> {
    if (!this.registry) {
      return err(new ValidationError("Registry not set"));
    }

    if (personaIds.length === 0) {
      return err(new ValidationError("At least one persona is required"));
    }

    const personas: Persona[] = [];
    for (const id of personaIds) {
      const persona = this.registry.get(id);
      if (!persona) {
        return err(new ValidationError("Persona not found", { personaId: id }));
      }
      personas.push(persona);
    }

    const synergyScore = this.calculateSynergy(personas);
    const coverageScore = this.calculateCoverage(personas, taskType);
    const conflictScore = this.calculateConflict(personas);
    const estimatedTokenCost = this.estimateTokenCostForPersonas(personas);

    const recommended = synergyScore > 0.5 && conflictScore < 0.3 && coverageScore > 0.6;

    const combination: PersonaCombinationInternal = {
      id: generateId(),
      personaIds: [...personaIds],
      strategy,
      synergyScore,
      coverageScore,
      conflictScore,
      estimatedTokenCost,
      recommended,
      sharedMemory: new Map(),
    };

    this.combinations.set(combination.id, combination);

    this.emit({
      type: "combination:created",
      timestamp: new Date().toISOString(),
      data: { combinationId: combination.id, personaIds, strategy, synergyScore, coverageScore },
    });

    return ok(combination);
  }

  optimize(combination: PersonaCombinationInternal): Result<PersonaCombinationInternal, ValidationError> {
    if (!this.registry) {
      return err(new ValidationError("Registry not set"));
    }

    const personas: Persona[] = [];
    for (const id of combination.personaIds) {
      const persona = this.registry.get(id);
      if (!persona) {
        return err(new ValidationError("Persona not found", { personaId: id }));
      }
      personas.push(persona);
    }

    let optimizedIds = [...combination.personaIds];
    let currentCost = combination.estimatedTokenCost;

    const sortedByWeight = personas
      .map((p) => ({ id: p.getId(), weight: p.getWeight(), promptLength: p.getSystemPrompt().length }))
      .sort((a, b) => b.weight - a.weight);

    const strategyLimits = STRATEGY_PERSONA_COUNTS[combination.strategy];
    const maxPersonas = Math.min(
      strategyLimits.max,
      DEFAULT_PERSONA_MESH_CONFIG.maxActivePersonas
    );

    if (optimizedIds.length > maxPersonas) {
      const topIds = sortedByWeight.slice(0, maxPersonas).map((p) => p.id);
      optimizedIds = topIds;
    }

    const tokenBudget = DEFAULT_PERSONA_MESH_CONFIG.tokenBudget;
    let totalTokens = 0;
    const keptIds: InternalPersonaId[] = [];

    for (const item of sortedByWeight) {
      const persona = this.registry.get(item.id);
      if (!persona) continue;

      const personaTokens = this.estimateTokenCostForPersona(persona);
      if (totalTokens + personaTokens <= tokenBudget || keptIds.length === 0) {
        keptIds.push(item.id);
        totalTokens += personaTokens;
      }
    }

    optimizedIds = keptIds;

    if (optimizedIds.length < strategyLimits.min) {
      const allPersonas = this.registry.list();
      for (const p of allPersonas) {
        if (!optimizedIds.includes(p.getId()) && optimizedIds.length < strategyLimits.min) {
          optimizedIds.push(p.getId());
        }
      }
    }

    const optimizedPersonas = optimizedIds
      .map((id) => this.registry!.get(id))
      .filter((p): p is Persona => p !== undefined);

    const synergyScore = this.calculateSynergy(optimizedPersonas);
    const coverageScore = this.calculateCoverage(optimizedPersonas, "");
    const conflictScore = this.calculateConflict(optimizedPersonas);
    const estimatedTokenCost = this.estimateTokenCostForPersonas(optimizedPersonas);

    const optimized: PersonaCombinationInternal = {
      id: generateId(),
      personaIds: optimizedIds,
      strategy: combination.strategy,
      synergyScore,
      coverageScore,
      conflictScore,
      estimatedTokenCost,
      recommended: synergyScore > 0.5 && conflictScore < 0.3 && coverageScore > 0.6,
      sharedMemory: combination.sharedMemory,
    };

    this.combinations.set(optimized.id, optimized);

    this.emit({
      type: "combination:optimized",
      timestamp: new Date().toISOString(),
      data: {
        originalId: combination.id,
        optimizedId: optimized.id,
        originalCost: currentCost,
        optimizedCost: estimatedTokenCost,
        personaCount: optimizedIds.length,
      },
    });

    return ok(optimized);
  }

  estimateTokenCost(combination: PersonaCombinationInternal): number {
    if (!this.registry) return combination.estimatedTokenCost;

    let total = 0;
    for (const id of combination.personaIds) {
      const persona = this.registry.get(id);
      if (persona) {
        total += this.estimateTokenCostForPersona(persona);
      }
    }
    return total;
  }

  selectForTask(
    taskType: string,
    complexity: number,
    strategy?: CombinationStrategy
  ): Result<PersonaCombinationInternal, ValidationError> {
    if (!this.registry) {
      return err(new ValidationError("Registry not set"));
    }

    const resolvedStrategy = strategy ?? this.inferStrategy(complexity);
    const candidates = this.registry.resolve(taskType);

    if (candidates.length === 0) {
      return err(new ValidationError("No personas available for task type", { taskType }));
    }

    const limits = STRATEGY_PERSONA_COUNTS[resolvedStrategy];
    const count = Math.min(
      Math.max(Math.ceil(complexity * limits.max), limits.min),
      limits.max,
      candidates.length
    );

    const selectedIds = candidates.slice(0, count).map((p) => p.getId());

    return this.combine(selectedIds, taskType, resolvedStrategy);
  }

  dynamicActivation(
    taskType: string,
    context: string
  ): Result<PersonaActivationInternal[], ValidationError> {
    if (!this.registry) {
      return err(new ValidationError("Registry not set"));
    }

    const candidates = this.registry.resolve(taskType);
    if (candidates.length === 0) {
      return err(new ValidationError("No personas available for task type", { taskType }));
    }

    const count = Math.min(candidates.length, DEFAULT_PERSONA_MESH_CONFIG.maxActivePersonas);
    const selected = candidates.slice(0, count);
    const now = new Date().toISOString();

    const activations: PersonaActivationInternal[] = selected.map((persona, index) => ({
      personaId: persona.getId(),
      state: PersonaState.Thinking,
      activatedAt: now,
      context,
      energyLevel: Math.max(0.3, 1.0 - index * 0.15),
    }));

    const combinationIds = activations.map((a) => a.personaId);
    const combinationResult = this.combine(combinationIds, taskType, "balanced");
    if (combinationResult.ok) {
      this.activeCombination = combinationResult.value;
    }

    for (const activation of activations) {
      this.emit({
        type: "persona:activated",
        timestamp: now,
        data: {
          personaId: activation.personaId,
          context,
          energyLevel: activation.energyLevel,
        },
      });
    }

    return ok(activations);
  }

  deactivateAll(): void {
    if (this.activeCombination) {
      for (const id of this.activeCombination.personaIds) {
        this.emit({
          type: "persona:deactivated",
          timestamp: new Date().toISOString(),
          data: { personaId: id },
        });
      }
      this.activeCombination = null;
    }
  }

  getActiveCombination(): PersonaCombinationInternal | null {
    return this.activeCombination;
  }

  getCombination(id: string): PersonaCombinationInternal | undefined {
    return this.combinations.get(id);
  }

  shareContext(key: string, value: unknown): void {
    if (this.activeCombination) {
      this.activeCombination.sharedMemory.set(key, value);
    }
  }

  getSharedContext(key: string): unknown {
    if (this.activeCombination) {
      return this.activeCombination.sharedMemory.get(key);
    }
    return undefined;
  }

  private calculateSynergy(personas: Persona[]): number {
    if (personas.length <= 1) return 1.0;

    let synergy = 0;
    let pairs = 0;

    for (let i = 0; i < personas.length; i++) {
      for (let j = i + 1; j < personas.length; j++) {
        const a = personas[i];
        const b = personas[j];

        let pairSynergy = 0.5;

        if (a.getRole() !== b.getRole()) {
          pairSynergy += 0.2;
        }

        const aExpertise = new Set(a.getExpertise());
        const bExpertise = new Set(b.getExpertise());
        const overlap = [...aExpertise].filter((e) => bExpertise.has(e)).length;
        const total = new Set([...aExpertise, ...bExpertise]).size;
        if (total > 0) {
          const diversity = 1 - overlap / total;
          pairSynergy += diversity * 0.2;
        }

        const aTasks = new Set(a.getPreferredTaskTypes());
        const bTasks = new Set(b.getPreferredTaskTypes());
        const taskOverlap = [...aTasks].filter((t) => bTasks.has(t)).length;
        if (taskOverlap > 0) {
          pairSynergy += 0.1;
        }

        synergy += Math.min(pairSynergy, 1.0);
        pairs++;
      }
    }

    return pairs > 0 ? synergy / pairs : 0;
  }

  private calculateCoverage(personas: Persona[], taskType: string): number {
    if (personas.length === 0) return 0;

    const allExpertise = new Set<string>();
    const allTaskTypes = new Set<string>();

    for (const persona of personas) {
      for (const exp of persona.getExpertise()) {
        allExpertise.add(exp);
      }
      for (const task of persona.getPreferredTaskTypes()) {
        allTaskTypes.add(task);
      }
    }

    let coverage = 0;

    if (taskType && allTaskTypes.has(taskType)) {
      coverage += 0.4;
    } else if (taskType) {
      for (const task of allTaskTypes) {
        if (task.includes(taskType) || taskType.includes(task)) {
          coverage += 0.2;
          break;
        }
      }
    }

    coverage += Math.min(allExpertise.size / 5, 1.0) * 0.3;
    coverage += Math.min(personas.length / 3, 1.0) * 0.3;

    return Math.min(coverage, 1.0);
  }

  private calculateConflict(personas: Persona[]): number {
    if (personas.length <= 1) return 0;

    let conflict = 0;
    let pairs = 0;

    for (let i = 0; i < personas.length; i++) {
      for (let j = i + 1; j < personas.length; j++) {
        const a = personas[i];
        const b = personas[j];

        let pairConflict = 0;

        const aBiases = a.getBiases();
        const bBiases = b.getBiases();

        for (const ab of aBiases) {
          for (const bb of bBiases) {
            if (ab.domain === bb.domain && ab.direction !== bb.direction) {
              pairConflict += 0.3 * Math.min(ab.strength, bb.strength);
            }
          }
        }

        const aTools = new Set(a.getTools());
        const bTools = new Set(b.getTools());
        const toolOverlap = [...aTools].filter((t) => bTools.has(t)).length;
        const toolTotal = new Set([...aTools, ...bTools]).size;
        if (toolTotal > 0 && toolOverlap / toolTotal > 0.8) {
          pairConflict += 0.1;
        }

        conflict += Math.min(pairConflict, 1.0);
        pairs++;
      }
    }

    return pairs > 0 ? conflict / pairs : 0;
  }

  private estimateTokenCostForPersona(persona: Persona): number {
    const promptTokens = Math.ceil(persona.getSystemPrompt().length / 4);
    const traitTokens = persona.getTraits().length * 20;
    const biasTokens = persona.getBiases().length * 15;
    const toolTokens = persona.getTools().length * 10;
    const constraintTokens = persona.getConstraints().length * 10;
    const baseOverhead = 100;

    return promptTokens + traitTokens + biasTokens + toolTokens + constraintTokens + baseOverhead;
  }

  private estimateTokenCostForPersonas(personas: Persona[]): number {
    return personas.reduce((sum, p) => sum + this.estimateTokenCostForPersona(p), 0);
  }

  private inferStrategy(complexity: number): CombinationStrategy {
    if (complexity <= 0.3) return "minimal";
    if (complexity <= 0.7) return "balanced";
    return "comprehensive";
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
}
