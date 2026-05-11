import type {
  OrchestratorConfig,
  OrchestratorEvent,
  OrchestratorEventName,
  OrchestratorEventHandler,
  EngineDependencies,
} from "./types.js";
import {
  CSEPhase,
  CSEStatus,
} from "@paracosm/shared";
import type {
  CSEIteration,
  CSEState,
  CSEContext,
  ConstructResult,
  SimulateResult,
  ExecuteResult,
  ReflectResult,
  EvolveResult,
  WorldModelState,
  PersonaCombination,
  SimulationConfig,
  EvolutionConfig,
  PersonaConfig,
  PersonaId,
} from "@paracosm/shared";
import type { Result } from "@paracosm/shared";
import { ok, err, generateId, generateUUID } from "@paracosm/shared";
import { DEFAULT_ORCHESTRATOR_CONFIG } from "./types.js";
import { EventBus } from "./event-bus.js";
import { StateMachine, createCSEStateMachine, createPhaseStateMachine } from "./state-machine.js";
import { ProgressTracker } from "./progress-tracker.js";
import { ContextManager } from "./context-manager.js";
import { Pipeline } from "./pipeline.js";
import { ConstructPhase } from "./phases/construct.js";
import { SimulatePhase } from "./phases/simulate.js";
import { ExecutePhase } from "./phases/execute.js";
import { ReflectPhase } from "./phases/reflect.js";
import { EvolvePhase } from "./phases/evolve.js";

export class CSEOrchestrator {
  private config: OrchestratorConfig;
  private eventBus: EventBus;
  private stateMachine: StateMachine;
  private phaseStateMachine: StateMachine;
  private progressTracker: ProgressTracker;
  private contextManager: ContextManager;
  private constructPhase: ConstructPhase;
  private simulatePhase: SimulatePhase;
  private executePhase: ExecutePhase;
  private reflectPhase: ReflectPhase;
  private evolvePhase: EvolvePhase;
  private engines: EngineDependencies | null;
  private context: CSEContext | null;
  private state: CSEState;
  private iterations: CSEIteration[];
  private currentIteration: CSEIteration | null;
  private cancelRequested: boolean;
  private pauseRequested: boolean;
  private resumePromise: { resolve: () => void; reject: (reason: unknown) => void } | null;

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
    this.eventBus = new EventBus();
    this.stateMachine = createCSEStateMachine();
    this.phaseStateMachine = createPhaseStateMachine();
    this.progressTracker = new ProgressTracker();
    this.contextManager = new ContextManager();
    this.constructPhase = new ConstructPhase();
    this.simulatePhase = new SimulatePhase();
    this.executePhase = new ExecutePhase();
    this.reflectPhase = new ReflectPhase();
    this.evolvePhase = new EvolvePhase();
    this.engines = null;
    this.context = null;
    this.state = {
      status: CSEStatus.Initialized,
      currentPhase: CSEPhase.Construct,
      iteration: 0,
      phaseHistory: [],
      phaseStartTime: null,
      totalDuration: 0,
      error: null,
    };
    this.iterations = [];
    this.currentIteration = null;
    this.cancelRequested = false;
    this.pauseRequested = false;
    this.resumePromise = null;
  }

  init(engines: EngineDependencies): void {
    this.engines = engines;
    this.emitEvent("orchestrator:initialized", { engines: Object.keys(engines) });
  }

  async run(userInput: string): Promise<Result<CSEIteration>> {
    if (!this.engines) {
      return err(new Error("Orchestrator not initialized. Call init() with engine dependencies first."));
    }

    if (this.state.status === CSEStatus.Running) {
      return err(new Error("Orchestrator is already running"));
    }

    this.cancelRequested = false;
    this.pauseRequested = false;

    const sessionId = generateUUID();
    const now = new Date().toISOString();

    this.context = {
      sessionId,
      userId: "default",
      parentSessionId: null,
      phase: CSEPhase.Construct,
      iteration: 0,
      maxIterations: this.config.maxIterations,
      startTime: now,
      deadline: null,
      worldModel: this.getWorldModelFromEngines(),
      personaConfig: this.getPersonaConfig(),
      simulationConfig: this.getSimulationConfig(),
      evolutionConfig: this.getEvolutionConfig(),
      metadata: { userInput },
    };

    this.state = {
      status: CSEStatus.Running,
      currentPhase: CSEPhase.Construct,
      iteration: 0,
      phaseHistory: [],
      phaseStartTime: now,
      totalDuration: 0,
      error: null,
    };

    this.stateMachine.transition("initialized", "running");
    this.emitEvent("orchestrator:started", { sessionId });

    const runStartTime = Date.now();

    try {
      for (let iteration = 1; iteration <= this.config.maxIterations; iteration++) {
        if (this.cancelRequested) {
          this.state.status = CSEStatus.Cancelled;
          this.stateMachine.transition("running", "cancelled");
          this.emitEvent("orchestrator:cancelled", { iteration });
          return err(new Error("Orchestrator cancelled"));
        }

        if (this.pauseRequested) {
          await this.waitForResume();
        }

        this.state.iteration = iteration;
        this.context!.iteration = iteration;
        this.context!.phase = CSEPhase.Construct;

        const iterationTaskId = `iteration_${iteration}`;
        this.progressTracker.start(iterationTaskId, CSEPhase.Construct);
        this.emitEvent("iteration:started", { iteration });

        const iterationStartTime = Date.now();

        const constructResult = await this.runConstructPhase(userInput, iteration);
        if (!constructResult) {
          this.state.status = CSEStatus.Failed;
          this.stateMachine.transition("running", "failed");
          return err(new Error(`Construct phase failed at iteration ${iteration}`));
        }

        this.progressTracker.update(iterationTaskId, 0.2);
        this.context!.phase = CSEPhase.Simulate;

        const simulateResult = await this.runSimulatePhase(constructResult, iteration);
        if (!simulateResult) {
          this.state.status = CSEStatus.Failed;
          this.stateMachine.transition("running", "failed");
          return err(new Error(`Simulate phase failed at iteration ${iteration}`));
        }

        this.progressTracker.update(iterationTaskId, 0.4);
        this.context!.phase = CSEPhase.Execute;

        const executeResult = await this.runExecutePhase(simulateResult, constructResult, iteration);
        if (!executeResult) {
          this.state.status = CSEStatus.Failed;
          this.stateMachine.transition("running", "failed");
          return err(new Error(`Execute phase failed at iteration ${iteration}`));
        }

        this.progressTracker.update(iterationTaskId, 0.6);
        this.context!.phase = CSEPhase.Reflect;

        const reflectResult = await this.runReflectPhase(simulateResult, executeResult, constructResult, iteration);
        if (!reflectResult) {
          this.state.status = CSEStatus.Failed;
          this.stateMachine.transition("running", "failed");
          return err(new Error(`Reflect phase failed at iteration ${iteration}`));
        }

        this.progressTracker.update(iterationTaskId, 0.8);
        this.context!.phase = CSEPhase.Evolve;

        const evolveResult = await this.runEvolvePhase(reflectResult, iteration);

        this.progressTracker.complete(iterationTaskId);

        const iterationResult: CSEIteration = {
          iteration,
          construct: constructResult,
          simulate: simulateResult,
          execute: executeResult,
          reflect: reflectResult,
          evolve: evolveResult,
          totalDuration: Date.now() - iterationStartTime,
          timestamp: new Date().toISOString(),
        };

        this.iterations.push(iterationResult);
        this.currentIteration = iterationResult;

        this.emitEvent("iteration:completed", {
          iteration,
          duration: iterationResult.totalDuration,
          performanceScore: reflectResult.performanceScore,
        });

        if (reflectResult.performanceScore >= 0.9 && this.isConverged(iteration)) {
          this.state.status = CSEStatus.Completed;
          this.stateMachine.transition("running", "completed");
          this.emitEvent("orchestrator:completed", {
            iterations: iteration,
            totalDuration: Date.now() - runStartTime,
          });
          this.state.totalDuration = Date.now() - runStartTime;
          return ok(iterationResult);
        }
      }

      this.state.status = CSEStatus.Completed;
      this.stateMachine.transition("running", "completed");
      this.emitEvent("orchestrator:completed", {
        iterations: this.config.maxIterations,
        totalDuration: Date.now() - runStartTime,
        reason: "max_iterations_reached",
      });
      this.state.totalDuration = Date.now() - runStartTime;

      if (this.currentIteration) {
        return ok(this.currentIteration);
      }

      return err(new Error("No iteration completed successfully"));
    } catch (error) {
      this.state.status = CSEStatus.Failed;
      this.state.error = error instanceof Error ? error.message : String(error);
      this.stateMachine.transition("running", "failed");
      this.emitEvent("orchestrator:failed", { error: this.state.error });
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  pause(): void {
    if (this.state.status !== CSEStatus.Running) {
      return;
    }
    this.pauseRequested = true;
    this.state.status = CSEStatus.Paused;
    this.stateMachine.transition("running", "paused");
    this.emitEvent("orchestrator:paused", { iteration: this.state.iteration });
  }

  resume(): void {
    if (this.state.status !== CSEStatus.Paused) {
      return;
    }
    this.pauseRequested = false;
    this.state.status = CSEStatus.Running;
    this.stateMachine.transition("paused", "running");
    this.emitEvent("orchestrator:resumed", { iteration: this.state.iteration });

    if (this.resumePromise) {
      this.resumePromise.resolve();
      this.resumePromise = null;
    }
  }

  cancel(): void {
    this.cancelRequested = true;
    if (this.resumePromise) {
      this.resumePromise.reject(new Error("Cancelled while paused"));
      this.resumePromise = null;
    }
  }

  getState(): CSEState {
    return { ...this.state };
  }

  onPhaseChange(handler: (phase: CSEPhase, iteration: number) => void): void {
    this.eventBus.on("phase:started" as string, (data: unknown) => {
      const event = data as Record<string, unknown>;
      handler(event.phase as CSEPhase, event.iteration as number);
    });
  }

  onProgress(handler: (progress: { phase: CSEPhase; iteration: number; progress: number }) => void): void {
    this.eventBus.on("progress:updated" as string, (data: unknown) => {
      handler(data as { phase: CSEPhase; iteration: number; progress: number });
    });
  }

  onError(handler: (error: Error) => void): void {
    this.eventBus.on("error:occurred" as string, (data: unknown) => {
      const event = data as Record<string, unknown>;
      handler(new Error(event.message as string));
    });
  }

  getIterations(): CSEIteration[] {
    return [...this.iterations];
  }

  getCurrentIteration(): CSEIteration | null {
    return this.currentIteration;
  }

  getContext(): CSEContext | null {
    return this.context;
  }

  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }

  private async runConstructPhase(userInput: string, iteration: number): Promise<ConstructResult | null> {
    this.emitEvent("phase:started", { phase: CSEPhase.Construct, iteration });
    this.phaseStateMachine.transition("idle", "construct");

    try {
      const worldModel = this.context?.worldModel ?? this.getWorldModelFromEngines();
      const result = this.constructPhase.execute({ userInput, worldModel });

      if (this.context) {
        this.context.worldModel = result.worldModel;
      }

      this.phaseStateMachine.transition("construct", "simulate");
      this.emitEvent("phase:completed", { phase: CSEPhase.Construct, iteration, duration: result.duration });

      return result;
    } catch (error) {
      this.phaseStateMachine.transition("construct", "failed");
      this.emitEvent("phase:failed", {
        phase: CSEPhase.Construct,
        iteration,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async runSimulatePhase(
    constructResult: ConstructResult,
    iteration: number
  ): Promise<SimulateResult | null> {
    this.emitEvent("phase:started", { phase: CSEPhase.Simulate, iteration });

    try {
      const personaCombination = this.selectPersonasForSimulation();

      const result = this.simulatePhase.execute({
        worldModel: constructResult.worldModel,
        personaCombination,
        simulationConfig: {
          maxPaths: this.config.maxConcurrentSimulations * 10,
          maxSteps: 100,
          timeLimitMs: this.config.phaseTimeoutMs,
          branchFactor: 3,
          pruningThreshold: 0.3,
        },
      });

      this.phaseStateMachine.transition("simulate", "execute");
      this.emitEvent("phase:completed", { phase: CSEPhase.Simulate, iteration, duration: result.duration });

      return result;
    } catch (error) {
      this.phaseStateMachine.transition("simulate", "failed");
      this.emitEvent("phase:failed", {
        phase: CSEPhase.Simulate,
        iteration,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async runExecutePhase(
    simulateResult: SimulateResult,
    constructResult: ConstructResult,
    iteration: number
  ): Promise<ExecuteResult | null> {
    this.emitEvent("phase:started", { phase: CSEPhase.Execute, iteration });

    try {
      const bestPath = simulateResult.bestPath;
      if (!bestPath) {
        this.phaseStateMachine.transition("execute", "failed");
        this.emitEvent("phase:failed", {
          phase: CSEPhase.Execute,
          iteration,
          error: "No best path available from simulation",
        });
        return null;
      }

      const simulationPath = this.findSimulationPathById(simulateResult, bestPath.pathId);
      if (!simulationPath) {
        this.phaseStateMachine.transition("execute", "failed");
        return null;
      }

      const result = this.executePhase.execute({
        path: simulationPath,
        worldModel: constructResult.worldModel,
        tools: {
          get: () => ({
            execute: async () => ({ toolId: "default", success: true, data: null, error: null, executionTimeMs: 0 }),
          }),
        },
      });

      this.phaseStateMachine.transition("execute", "reflect");
      this.emitEvent("phase:completed", { phase: CSEPhase.Execute, iteration, duration: result.duration });

      return result;
    } catch (error) {
      this.phaseStateMachine.transition("execute", "failed");
      this.emitEvent("phase:failed", {
        phase: CSEPhase.Execute,
        iteration,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async runReflectPhase(
    simulateResult: SimulateResult,
    executeResult: ExecuteResult,
    constructResult: ConstructResult,
    iteration: number
  ): Promise<ReflectResult | null> {
    this.emitEvent("phase:started", { phase: CSEPhase.Reflect, iteration });

    try {
      const result = this.reflectPhase.execute({
        expected: simulateResult,
        actual: executeResult,
        constructResult,
        worldModel: this.context?.worldModel ?? this.getWorldModelFromEngines(),
      });

      this.phaseStateMachine.transition("reflect", "evolve");
      this.emitEvent("phase:completed", { phase: CSEPhase.Reflect, iteration, duration: result.duration });

      return result;
    } catch (error) {
      this.phaseStateMachine.transition("reflect", "failed");
      this.emitEvent("phase:failed", {
        phase: CSEPhase.Reflect,
        iteration,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async runEvolvePhase(
    reflectResult: ReflectResult,
    iteration: number
  ): Promise<EvolveResult> {
    this.emitEvent("phase:started", { phase: CSEPhase.Evolve, iteration });

    try {
      const result = this.evolvePhase.execute({
        reflectResult: {
          performanceScore: reflectResult.performanceScore,
          lessonsLearned: reflectResult.lessonsLearned,
          improvementAreas: reflectResult.improvementAreas,
        },
        pool: null,
        config: this.getEvolutionConfig(),
        personaRegistry: null,
        router: null,
        persistence: null,
      });

      this.phaseStateMachine.transition("evolve", "completed");
      this.emitEvent("phase:completed", { phase: CSEPhase.Evolve, iteration, duration: result.duration });

      return result;
    } catch (error) {
      this.phaseStateMachine.transition("evolve", "failed");
      this.emitEvent("phase:failed", {
        phase: CSEPhase.Evolve,
        iteration,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        evolutionResult: null,
        genesImproved: 0,
        genesCreated: 0,
        genesRetired: 0,
        fitnessImprovement: 0,
        diversityChange: 0,
        duration: 0,
      };
    }
  }

  private emitEvent(type: OrchestratorEventName, data: Record<string, unknown>): void {
    const event: OrchestratorEvent = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };
    this.eventBus.emit(type, event);
  }

  private async waitForResume(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.resumePromise = { resolve, reject };
    });
  }

  private isConverged(iteration: number): boolean {
    if (iteration < 2) return false;

    const recentIterations = this.iterations.slice(-3);
    if (recentIterations.length < 2) return false;

    const scores = recentIterations.map((it) => it.reflect.performanceScore);
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;

    return variance < 0.01 && avgScore >= 0.9;
  }

  private getWorldModelFromEngines(): WorldModelState {
    if (this.engines?.worldModelEngine && typeof (this.engines.worldModelEngine as any).getState === "function") {
      return (this.engines.worldModelEngine as any).getState();
    }

    return {
      entityGraph: {
        entities: new Map(),
        relations: new Map(),
        adjacency: new Map(),
        reverseAdjacency: new Map(),
      },
      timeline: {
        events: new Map(),
        causalLinks: [],
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        resolution: 1,
      },
      constraintMap: {
        constraints: new Map(),
        entityConstraints: new Map(),
        violatedConstraints: [],
      },
      goalStack: {
        goals: new Map(),
        activeGoals: [],
        completedGoals: [],
        failedGoals: [],
      },
      version: 0,
      checksum: "",
    };
  }

  private getPersonaConfig(): PersonaConfig {
    return {
      personaIds: [],
      debateRounds: 3,
      consensusThreshold: 0.7,
      timeLimitMs: 300000,
      allowDissent: true,
      minParticipants: 2,
      maxParticipants: 5,
    };
  }

  private getSimulationConfig(): SimulationConfig {
    return {
      maxSteps: 100,
      maxPaths: 50,
      timeLimitMs: 30000,
      branchFactor: 3,
      pruningThreshold: 0.3,
      explorationRate: 0.2,
      seed: null,
      snapshotInterval: 10,
      parallelPaths: 4,
      earlyTermination: true,
      earlyTerminationThreshold: 0.95,
    };
  }

  private getEvolutionConfig(): EvolutionConfig {
    return {
      populationSize: 100,
      maxGenerations: 500,
      mutationRate: 0.1,
      crossoverRate: 0.7,
      elitismCount: 5,
      tournamentSize: 5,
      stagnationThreshold: 0.001,
      diversityThreshold: 0.3,
      fitnessThreshold: 0.95,
      maxGeneLength: 1024,
      selectionPressure: 1.5,
      migrationInterval: 50,
      migrationCount: 5,
    };
  }

  private selectPersonasForSimulation(): PersonaCombination | null {
    if (this.engines?.personaMeshEngine && typeof (this.engines.personaMeshEngine as any).getActiveCombination === "function") {
      return (this.engines.personaMeshEngine as any).getActiveCombination();
    }
    return null;
  }

  private findSimulationPathById(simulateResult: SimulateResult, pathId: string): import("@paracosm/shared").SimulationPath | null {
    for (const simulation of simulateResult.simulations) {
      if (simulation.pathId === pathId) {
        return {
          id: pathId as any,
          steps: [],
          probability: 1,
          totalDuration: simulation.executionTime,
          branchPoint: null,
          parentPathId: null,
          childPathIds: [],
        };
      }
    }
    return null;
  }
}
