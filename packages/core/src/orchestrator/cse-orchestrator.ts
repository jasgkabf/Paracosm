import { CSEPhase } from '@paracosm/shared';
import type { CSEContext, CSEState, ConstructResult, SimulateResult, ExecuteResult, ReflectResult, EvolveResult } from '@paracosm/shared';
import { ok, err, type Result, createLogger } from '@paracosm/shared';
import { EventBus } from './event-bus.js';
import { StateMachine } from './state-machine.js';
import { ProgressTracker } from './progress-tracker.js';
import { ContextManager } from './context-manager.js';
import { Pipeline } from './pipeline.js';
import { ConstructPhase } from './phases/construct.js';
import { SimulatePhase } from './phases/simulate.js';
import { ExecutePhase } from './phases/execute.js';
import { ReflectPhase } from './phases/reflect.js';
import { EvolvePhase } from './phases/evolve.js';
import type { OrchestratorConfig } from './types.js';
import { DEFAULT_ORCHESTRATOR_CONFIG } from './types.js';

const logger = createLogger('CSEOrchestrator');

export class CSEOrchestrator {
  private config: OrchestratorConfig;
  private eventBus: EventBus;
  private stateMachine: StateMachine;
  private progressTracker: ProgressTracker;
  private contextManager: ContextManager;
  private pipeline: Pipeline;
  private constructPhase: ConstructPhase;
  private simulatePhase: SimulatePhase;
  private executePhase: ExecutePhase;
  private reflectPhase: ReflectPhase;
  private evolvePhase: EvolvePhase;
  private iteration: number = 0;
  private running: boolean = false;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
    this.eventBus = new EventBus();
    this.stateMachine = new StateMachine();
    this.progressTracker = new ProgressTracker();
    this.contextManager = new ContextManager();
    this.pipeline = new Pipeline(this.eventBus);
    this.constructPhase = new ConstructPhase();
    this.simulatePhase = new SimulatePhase();
    this.executePhase = new ExecutePhase();
    this.reflectPhase = new ReflectPhase();
    this.evolvePhase = new EvolvePhase();
    this.setupStateMachineListeners();
  }

  private setupStateMachineListeners(): void {
    this.stateMachine.onTransition((from, to) => {
      this.eventBus.emit('phase:transition', { from, to, iteration: this.iteration });
      this.progressTracker.record(to, this.iteration, 'phase_transition', 0.2, { from, to });
    });
  }

  on(event: string, callback: (event: string, data: unknown) => void): () => void {
    return this.eventBus.on(event, callback);
  }

  createContext(data: { userId: string; query: string; activePersonas?: string[]; availableTools?: string[]; budgetRemaining?: number; tokenBudget?: number; metadata?: Record<string, unknown> }): CSEContext {
    return this.contextManager.createContext(data);
  }

  async runCycle(context?: CSEContext): Promise<Result<Record<string, unknown>>> {
    const activeContext = context ?? this.contextManager.getActiveContext();
    if (!activeContext) {
      return err(new Error('No active context. Create a context first.'));
    }
    if (this.running) {
      return err(new Error('Orchestrator is already running'));
    }
    this.running = true;
    this.iteration++;
    const results: Record<string, unknown> = {};
    try {
      this.eventBus.emit('cycle:start', { iteration: this.iteration, sessionId: activeContext.sessionId });
      const constructResult = this.constructPhase.execute(activeContext);
      if (!constructResult.ok) return err(constructResult.err);
      results.construct = constructResult.value;
      this.progressTracker.record(CSEPhase.CONSTRUCT, this.iteration, 'complete', 0.2);
      this.stateMachine.transition(CSEPhase.SIMULATE);
      const simulateResult = this.simulatePhase.execute(activeContext);
      if (!simulateResult.ok) return err(simulateResult.err);
      results.simulate = simulateResult.value;
      this.progressTracker.record(CSEPhase.SIMULATE, this.iteration, 'complete', 0.4);
      this.stateMachine.transition(CSEPhase.EXECUTE);
      const executeResult = this.executePhase.execute(activeContext);
      if (!executeResult.ok) return err(executeResult.err);
      results.execute = executeResult.value;
      this.progressTracker.record(CSEPhase.EXECUTE, this.iteration, 'complete', 0.6);
      this.stateMachine.transition(CSEPhase.REFLECT);
      const reflectResult = this.reflectPhase.execute(activeContext);
      if (!reflectResult.ok) return err(reflectResult.err);
      results.reflect = reflectResult.value;
      this.progressTracker.record(CSEPhase.REFLECT, this.iteration, 'complete', 0.8);
      this.stateMachine.transition(CSEPhase.EVOLVE);
      const evolveResult = this.evolvePhase.execute(activeContext);
      if (!evolveResult.ok) return err(evolveResult.err);
      results.evolve = evolveResult.value;
      this.progressTracker.record(CSEPhase.EVOLVE, this.iteration, 'complete', 1.0);
      this.stateMachine.transition(CSEPhase.CONSTRUCT);
      this.eventBus.emit('cycle:complete', { iteration: this.iteration, results });
      return ok(results);
    } catch (error) {
      this.eventBus.emit('cycle:error', { iteration: this.iteration, error });
      return err(new Error(`Cycle failed: ${error instanceof Error ? error.message : String(error)}`));
    } finally {
      this.running = false;
    }
  }

  async runMultipleCycles(count: number, context?: CSEContext): Promise<Result<Record<string, unknown>[]>> {
    const allResults: Record<string, unknown>[] = [];
    for (let i = 0; i < count; i++) {
      if (this.iteration >= this.config.maxIterations) {
        logger.info(`Max iterations (${this.config.maxIterations}) reached`);
        break;
      }
      const result = await this.runCycle(context);
      if (!result.ok) {
        return err(new Error(`Cycle ${i + 1} failed: ${result.err}`));
      }
      allResults.push(result.value);
    }
    return ok(allResults);
  }

  getCurrentPhase(): CSEPhase {
    return this.stateMachine.getCurrentPhase();
  }

  getIteration(): number {
    return this.iteration;
  }

  getProgress(): number {
    return this.progressTracker.getOverallProgress();
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }

  getStateMachine(): StateMachine {
    return this.stateMachine;
  }

  getProgressTracker(): ProgressTracker {
    return this.progressTracker;
  }

  getContextManager(): ContextManager {
    return this.contextManager;
  }

  isRunning(): boolean {
    return this.running;
  }

  reset(): void {
    this.stateMachine.reset();
    this.progressTracker.clear();
    this.iteration = 0;
    this.running = false;
    this.eventBus.emit('orchestrator:reset', null);
  }

  clear(): void {
    this.reset();
    this.contextManager.clear();
    this.pipeline.clear();
    this.eventBus.clear();
  }
}
