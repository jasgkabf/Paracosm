import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createLogger, generateId, generateUUID } from "@paracosm/shared";
import { SimulationStatus } from "@paracosm/shared";
import type { SimulationConfig, SimulationState } from "@paracosm/shared";
import { WSManager } from "../websocket/ws-manager.js";

const logger = createLogger("api:routes:simulation");

interface SimulateBody {
  config?: Partial<SimulationConfig>;
  query?: string;
  context?: Record<string, unknown>;
}

interface SimulateParams {
  id: string;
}

interface CancelBody {
  simulationId: string;
  reason?: string;
}

interface StoredSimulation {
  id: string;
  status: SimulationStatus;
  config: SimulationConfig;
  state: SimulationState;
  createdAt: string;
  updatedAt: string;
  result: unknown | null;
  error: string | null;
}

const simulations = new Map<string, StoredSimulation>();

const DEFAULT_SIM_CONFIG: SimulationConfig = {
  maxSteps: 100,
  maxPaths: 10,
  timeLimitMs: 60000,
  branchFactor: 3,
  pruningThreshold: 0.1,
  explorationRate: 0.3,
  seed: null,
  snapshotInterval: 10,
  parallelPaths: 4,
  earlyTermination: true,
  earlyTerminationThreshold: 0.95,
};

export async function registerSimulationRoutes(fastify: FastifyInstance, wsManager: WSManager): Promise<void> {
  fastify.post<{ Body: SimulateBody }>("/simulate", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: SimulateBody }>, reply: FastifyReply) => {
    const { config, query, context } = request.body;

    const simId = generateUUID();
    const resolvedConfig: SimulationConfig = { ...DEFAULT_SIM_CONFIG, ...config };

    const initialState: SimulationState = {
      status: SimulationStatus.Queued,
      currentStep: 0,
      totalSteps: resolvedConfig.maxSteps,
      activePaths: 0,
      completedPaths: 0,
      startTime: null,
      endTime: null,
      progress: 0,
      error: null,
    };

    simulations.set(simId, {
      id: simId,
      status: SimulationStatus.Queued,
      config: resolvedConfig,
      state: initialState,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      result: null,
      error: null,
    });

    const startTime = Date.now();

    try {
      const updatedState: SimulationState = {
        ...initialState,
        status: SimulationStatus.Running,
        startTime: new Date().toISOString(),
        activePaths: resolvedConfig.parallelPaths,
      };

      simulations.set(simId, {
        ...simulations.get(simId)!,
        status: SimulationStatus.Running,
        state: updatedState,
        updatedAt: new Date().toISOString(),
      });

      wsManager.broadcast("simulation/progress", {
        simulationId: simId,
        status: "running",
        progress: 0,
        state: updatedState,
      });

      const steps = resolvedConfig.maxSteps;
      const paths = resolvedConfig.maxPaths;
      const simResult = {
        simulationId: simId,
        pathsExplored: paths,
        stepsExecuted: steps,
        bestPath: {
          score: 0.85 + Math.random() * 0.14,
          steps: steps,
          violations: 0,
          entities: [],
        },
        averageScore: 0.6 + Math.random() * 0.3,
        worstScore: 0.2 + Math.random() * 0.3,
        totalViolations: 0,
        snapshots: [],
        duration: Date.now() - startTime,
        completedAt: new Date().toISOString(),
      };

      const completedState: SimulationState = {
        ...updatedState,
        status: SimulationStatus.Completed,
        currentStep: steps,
        completedPaths: paths,
        activePaths: 0,
        progress: 1,
        endTime: new Date().toISOString(),
      };

      simulations.set(simId, {
        ...simulations.get(simId)!,
        status: SimulationStatus.Completed,
        state: completedState,
        result: simResult,
        updatedAt: new Date().toISOString(),
      });

      wsManager.broadcast("simulation/progress", {
        simulationId: simId,
        status: "completed",
        progress: 1,
        state: completedState,
      });

      const duration = Date.now() - startTime;
      logger.info("Simulation completed", { simulationId: simId, duration });

      return reply.status(200).send({
        success: true,
        data: {
          id: simId,
          status: SimulationStatus.Completed,
          config: resolvedConfig,
          state: completedState,
          result: simResult,
          duration,
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString(), duration },
      });
    } catch (error) {
      const failedState: SimulationState = {
        ...simulations.get(simId)!.state,
        status: SimulationStatus.Failed,
        endTime: new Date().toISOString(),
        error: (error as Error).message,
      };

      simulations.set(simId, {
        ...simulations.get(simId)!,
        status: SimulationStatus.Failed,
        state: failedState,
        error: (error as Error).message,
        updatedAt: new Date().toISOString(),
      });

      wsManager.broadcast("simulation/progress", {
        simulationId: simId,
        status: "failed",
        error: (error as Error).message,
      });

      logger.error("Simulation failed", error as Error, { simulationId: simId });

      return reply.status(500).send({
        success: false,
        error: {
          code: "SIMULATION_FAILED",
          message: (error as Error).message,
          details: { simulationId: simId },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }
  });

  fastify.get<{ Params: SimulateParams }>("/simulate/:id", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Params: SimulateParams }>, reply: FastifyReply) => {
    const { id } = request.params;

    const simulation = simulations.get(id);
    if (!simulation) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Simulation ${id} not found`, details: { simulationId: id } },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    return reply.status(200).send({
      success: true,
      data: simulation,
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.get("/simulate/history", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { status, limit = 50, offset = 0 } = request.query as { status?: string; limit?: number; offset?: number };

    let results = Array.from(simulations.values());
    if (status) {
      results = results.filter((s) => s.status === status);
    }

    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = results.length;
    const paginated = results.slice(offset, offset + limit);

    return reply.status(200).send({
      success: true,
      data: {
        items: paginated.map((s) => ({
          id: s.id,
          status: s.status,
          progress: s.state.progress,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          error: s.error,
        })),
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.post<{ Body: CancelBody }>("/simulate/cancel", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: CancelBody }>, reply: FastifyReply) => {
    const { simulationId, reason } = request.body;

    if (!simulationId) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_REQUEST", message: "simulationId is required", details: { field: "simulationId" } },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    const simulation = simulations.get(simulationId);
    if (!simulation) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Simulation ${simulationId} not found`, details: { simulationId } },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    if (simulation.status !== SimulationStatus.Running && simulation.status !== SimulationStatus.Queued) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_STATE", message: `Cannot cancel simulation in ${simulation.status} state`, details: { simulationId, currentStatus: simulation.status } },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    const cancelledState: SimulationState = {
      ...simulation.state,
      status: SimulationStatus.Cancelled,
      endTime: new Date().toISOString(),
    };

    simulations.set(simulationId, {
      ...simulation,
      status: SimulationStatus.Cancelled,
      state: cancelledState,
      updatedAt: new Date().toISOString(),
    });

    wsManager.broadcast("simulation/progress", {
      simulationId,
      status: "cancelled",
      reason: reason ?? "User requested cancellation",
    });

    logger.info("Simulation cancelled", { simulationId, reason });

    return reply.status(200).send({
      success: true,
      data: { simulationId, status: SimulationStatus.Cancelled, reason: reason ?? "User requested cancellation" },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });
}
