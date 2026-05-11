import { ok, err } from "@paracosm/shared";
import type { Result } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import { PersonaState } from "@paracosm/shared";
import { Persona } from "./persona.js";
import { PersonaRegistry } from "./persona-registry.js";
import { PersonaCombiner } from "./persona-combiner.js";
import { DebateProtocol } from "./debate-protocol.js";
import { DebateAggregator } from "./debate-aggregator.js";
import { DebateScoring } from "./debate-scoring.js";
import { PersonaLearning } from "./persona-learning.js";
import { ArchitectPersona } from "./personas/architect.js";
import { ExecutorPersona } from "./personas/executor.js";
import { CriticPersona } from "./personas/critic.js";
import { DreamerPersona } from "./personas/dreamer.js";
import { CuratorPersona } from "./personas/curator.js";
import type {
  InternalPersonaId,
  PersonaMeshConfig,
  PersonaCombinationInternal,
  PersonaActivationInternal,
  PersonaPerformance,
  DebateResultInternal,
  CombinationStrategy,
  PersonaMeshEvent,
  PersonaMeshEventName,
  PersonaMeshEventHandler,
} from "./types.js";
import { DEFAULT_PERSONA_MESH_CONFIG } from "./types.js";

export interface DebateOptions {
  strategy?: CombinationStrategy;
  maxRounds?: number;
  timeLimitMs?: number;
  consensusThreshold?: number;
  allowDissent?: boolean;
}

export class PersonaMeshEngine {
  private config: PersonaMeshConfig;
  private registry: PersonaRegistry;
  private combiner: PersonaCombiner;
  private protocol: DebateProtocol;
  private aggregator: DebateAggregator;
  private scoring: DebateScoring;
  private learning: PersonaLearning;
  private eventHandlers: Map<PersonaMeshEventName, Set<PersonaMeshEventHandler>>;
  private initialized: boolean;
  private activePersonas: Map<InternalPersonaId, Persona>;
  private activeCombination: PersonaCombinationInternal | null;

  constructor(config?: Partial<PersonaMeshConfig>) {
    this.config = { ...DEFAULT_PERSONA_MESH_CONFIG, ...config };
    this.registry = new PersonaRegistry();
    this.combiner = new PersonaCombiner();
    this.protocol = new DebateProtocol();
    this.aggregator = new DebateAggregator();
    this.scoring = new DebateScoring();
    this.learning = new PersonaLearning();
    this.eventHandlers = new Map();
    this.initialized = false;
    this.activePersonas = new Map();
    this.activeCombination = null;

    this.combiner.setRegistry(this.registry);
    this.learning.setRegistry(this.registry);
  }

  init(registry?: PersonaRegistry): Result<true, ValidationError> {
    if (this.initialized) {
      return err(new ValidationError("PersonaMeshEngine is already initialized"));
    }

    if (registry) {
      for (const persona of registry.list()) {
        const result = this.registry.register(persona);
        if (!result.ok) return result;
      }
    } else {
      const builtInResult = this.registry.registerBuiltInPersonas([
        () => ArchitectPersona.create(),
        () => ExecutorPersona.create(),
        () => CriticPersona.create(),
        () => DreamerPersona.create(),
        () => CuratorPersona.create(),
      ]);
      if (!builtInResult.ok) return builtInResult;
    }

    this.combiner.setRegistry(this.registry);
    this.learning.setRegistry(this.registry);

    this.initialized = true;

    this.emit({
      type: "engine:initialized",
      timestamp: new Date().toISOString(),
      data: { personaCount: this.registry.count() },
    });

    return ok(true);
  }

  shutdown(): Result<true, ValidationError> {
    if (!this.initialized) {
      return err(new ValidationError("PersonaMeshEngine is not initialized"));
    }

    this.deactivatePersonas();
    this.protocol.reset();
    this.learning.resetAll();

    this.initialized = false;

    this.emit({
      type: "engine:shutdown",
      timestamp: new Date().toISOString(),
      data: {},
    });

    return ok(true);
  }

  activatePersonas(taskType: string, complexity: number = 0.5): Result<PersonaCombinationInternal, ValidationError> {
    if (!this.initialized) {
      return err(new ValidationError("PersonaMeshEngine is not initialized"));
    }

    const combinationResult = this.combiner.selectForTask(taskType, complexity);
    if (!combinationResult.ok) return combinationResult;

    const combination = combinationResult.value;
    this.activeCombination = combination;

    for (const id of combination.personaIds) {
      const persona = this.registry.get(id);
      if (persona) {
        const activated = persona.setState(PersonaState.Thinking);
        this.activePersonas.set(id, activated);
      }
    }

    return ok(combination);
  }

  deactivatePersonas(): void {
    for (const [id, persona] of this.activePersonas) {
      const deactivated = persona.setState(PersonaState.Idle);
      if (this.registry.has(id)) {
        this.registry.hotReload(deactivated);
      }

      this.emit({
        type: "persona:deactivated",
        timestamp: new Date().toISOString(),
        data: { personaId: id },
      });
    }

    this.activePersonas.clear();
    this.activeCombination = null;
    this.combiner.deactivateAll();
  }

  async runDebate(topic: string, options?: DebateOptions): Promise<Result<DebateResultInternal, ValidationError>> {
    if (!this.initialized) {
      return err(new ValidationError("PersonaMeshEngine is not initialized"));
    }

    if (this.activePersonas.size === 0) {
      return err(new ValidationError("No active personas. Call activatePersonas() first."));
    }

    const maxRounds = options?.maxRounds ?? this.config.debateRounds;
    const timeLimitMs = options?.timeLimitMs ?? this.config.timeLimitMs;
    const consensusThreshold = options?.consensusThreshold ?? this.config.consensusThreshold;

    this.protocol.setMaxRounds(maxRounds);
    this.protocol.setScoring(this.scoring);

    const personaIds = Array.from(this.activePersonas.keys());

    const context = this.protocol.initiate(topic, personaIds);

    if (timeLimitMs > 0) {
      this.protocol.timeBox(timeLimitMs);
    }

    this.protocol.advancePhase();

    for (const [id, persona] of this.activePersonas) {
      const updated = persona.setState(PersonaState.Debating);
      this.activePersonas.set(id, updated);
    }

    const result = this.protocol.conclude();

    const aggregatedResult = this.aggregator.aggregate(context.rounds);

    const finalResult: DebateResultInternal = {
      ...aggregatedResult,
      duration: result.duration || aggregatedResult.duration,
      report: aggregatedResult.report || result.report,
    };

    if (this.config.enableLearning) {
      for (const id of personaIds) {
        const isSuccess = finalResult.outcome !== "inconclusive";
        this.learning.learnFromResult(id, finalResult, isSuccess);
      }
    }

    for (const [id, persona] of this.activePersonas) {
      const updated = persona.setState(PersonaState.Idle);
      this.activePersonas.set(id, updated);
    }

    return ok(finalResult);
  }

  getActivePersonas(): Persona[] {
    return Array.from(this.activePersonas.values());
  }

  getPerformance(personaId: InternalPersonaId): PersonaPerformance {
    return this.learning.trackPerformance(personaId);
  }

  getRegistry(): PersonaRegistry {
    return this.registry;
  }

  getCombiner(): PersonaCombiner {
    return this.combiner;
  }

  getProtocol(): DebateProtocol {
    return this.protocol;
  }

  getAggregator(): DebateAggregator {
    return this.aggregator;
  }

  getScoring(): DebateScoring {
    return this.scoring;
  }

  getLearning(): PersonaLearning {
    return this.learning;
  }

  getConfig(): PersonaMeshConfig {
    return { ...this.config };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getActiveCombination(): PersonaCombinationInternal | null {
    return this.activeCombination;
  }

  registerPersona(persona: Persona): Result<true, ValidationError> {
    if (!this.initialized) {
      return err(new ValidationError("PersonaMeshEngine is not initialized"));
    }
    return this.registry.register(persona);
  }

  unregisterPersona(id: InternalPersonaId): Result<true, ValidationError> {
    if (!this.initialized) {
      return err(new ValidationError("PersonaMeshEngine is not initialized"));
    }

    if (this.activePersonas.has(id)) {
      this.activePersonas.delete(id);
    }

    return this.registry.unregister(id);
  }

  on(event: PersonaMeshEventName, handler: PersonaMeshEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    this.registry.on(event, handler);
    this.combiner.on(event, handler);
    this.protocol.on(event, handler);
    this.learning.on(event, handler);
  }

  off(event: PersonaMeshEventName, handler: PersonaMeshEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }

    this.registry.off(event, handler);
    this.combiner.off(event, handler);
    this.protocol.off(event, handler);
    this.learning.off(event, handler);
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
