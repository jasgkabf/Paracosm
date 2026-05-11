import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createLogger, generateId, generateUUID } from "@paracosm/shared";
import {
  EntityType,
  ConstraintType,
  ConstraintStatus,
  GoalPriority,
  GoalState,
  EventSeverity,
} from "@paracosm/shared";
import type { EntityId, ConstraintId, GoalId } from "@paracosm/shared";
import { WSManager } from "../websocket/ws-manager.js";

const logger = createLogger("api:routes:world-model");

interface StoredEntity {
  id: string;
  name: string;
  type: EntityType;
  description: string;
  properties: Array<{ key: string; value: unknown; type: string; mutable: boolean }>;
  tags: string[];
  metadata: Record<string, unknown>;
  parentId: string | null;
  childIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface StoredConstraint {
  id: string;
  name: string;
  type: ConstraintType;
  status: ConstraintStatus;
  description: string;
  expression: string;
  priority: number;
  penalty: number;
  scope: string[];
  createdAt: string;
  updatedAt: string;
}

interface StoredGoal {
  id: string;
  name: string;
  description: string;
  priority: GoalPriority;
  state: GoalState;
  parentGoalId: string | null;
  subGoalIds: string[];
  constraints: string[];
  successCriteria: string;
  progress: number;
  deadline: string | null;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoredEvent {
  id: string;
  name: string;
  description: string;
  timestamp: string;
  severity: EventSeverity;
  entityId: string;
  payload: Record<string, unknown>;
  duration: number | null;
}

const entities = new Map<string, StoredEntity>();
const constraints = new Map<string, StoredConstraint>();
const goals = new Map<string, StoredGoal>();
const events = new Map<string, StoredEvent>();
const violatedConstraintIds: string[] = [];
const activeGoalIds: string[] = [];
const completedGoalIds: string[] = [];
const failedGoalIds: string[] = [];

let worldVersion = 1;
let worldLastUpdated = new Date().toISOString();

function seedWorldData(): void {
  const entityTypes = [
    EntityType.Agent, EntityType.Resource, EntityType.Location,
    EntityType.Event, EntityType.Concept, EntityType.Organization,
    EntityType.Artifact, EntityType.Process,
  ];
  const sampleNames: Record<string, string[]> = {
    [EntityType.Agent]: ["Orchestrator", "Analyst", "Executor"],
    [EntityType.Resource]: ["Compute Pool", "Memory Bank", "Network Channel"],
    [EntityType.Location]: ["Main Hub", "Processing Center", "Data Vault"],
    [EntityType.Event]: ["Initialization", "Configuration", "Deployment"],
    [EntityType.Concept]: ["Strategy", "Optimization", "Adaptation"],
    [EntityType.Organization]: ["Core Team", "Operations", "Research"],
    [EntityType.Artifact]: ["Blueprint", "Report", "Configuration"],
    [EntityType.Process]: ["Evolution", "Simulation", "Analysis"],
  };

  for (const type of entityTypes) {
    const names = sampleNames[type] ?? ["Unknown"];
    for (const name of names) {
      const id = generateId();
      entities.set(id, {
        id,
        name,
        type,
        description: `${name} ${type} entity`,
        properties: [{ key: "status", value: "active", type: "string", mutable: true }],
        tags: [type],
        metadata: {},
        parentId: null,
        childIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  const constraintTypes = [ConstraintType.Hard, ConstraintType.Soft, ConstraintType.Preference, ConstraintType.Resource, ConstraintType.Temporal, ConstraintType.Logical];
  const constraintStatuses = [ConstraintStatus.Active, ConstraintStatus.Satisfied, ConstraintStatus.Violated, ConstraintStatus.Relaxed];
  for (let i = 0; i < 6; i++) {
    const id = generateId();
    const status = constraintStatuses[i % constraintStatuses.length];
    constraints.set(id, {
      id,
      name: `Constraint ${i + 1}`,
      type: constraintTypes[i],
      status,
      description: `Sample ${constraintTypes[i]} constraint`,
      expression: `value >= ${i * 10}`,
      priority: i,
      penalty: i * 0.1,
      scope: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (status === ConstraintStatus.Violated) {
      violatedConstraintIds.push(id);
    }
  }

  const goalPriorities = [GoalPriority.Critical, GoalPriority.High, GoalPriority.Medium, GoalPriority.Low, GoalPriority.Optional];
  const goalStates = [GoalState.Active, GoalState.InProgress, GoalState.Completed, GoalState.Pending, GoalState.Failed];
  for (let i = 0; i < 5; i++) {
    const id = generateId();
    const state = goalStates[i];
    goals.set(id, {
      id,
      name: `Goal ${i + 1}`,
      description: `Sample goal with priority ${goalPriorities[i]}`,
      priority: goalPriorities[i],
      state,
      parentGoalId: null,
      subGoalIds: [],
      constraints: [],
      successCriteria: `Criteria for goal ${i + 1}`,
      progress: state === GoalState.Completed ? 1 : state === GoalState.InProgress ? 0.5 : 0,
      deadline: null,
      assignee: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (state === GoalState.Active || state === GoalState.InProgress) activeGoalIds.push(id);
    if (state === GoalState.Completed) completedGoalIds.push(id);
    if (state === GoalState.Failed) failedGoalIds.push(id);
  }

  const severities: EventSeverity[] = [EventSeverity.Info, EventSeverity.Warning, EventSeverity.Critical];
  for (let i = 0; i < 10; i++) {
    const id = generateId();
    events.set(id, {
      id,
      name: `Event ${i + 1}`,
      description: `Sample event ${i + 1}`,
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
      severity: severities[i % 3],
      entityId: Array.from(entities.keys())[i % entities.size] ?? "",
      payload: {},
      duration: null,
    });
  }
}

seedWorldData();

export async function registerWorldModelRoutes(fastify: FastifyInstance, wsManager: WSManager): Promise<void> {
  fastify.get("/world/status", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const status = {
      status: "active",
      version: worldVersion,
      lastUpdated: worldLastUpdated,
      entityCount: entities.size,
      constraintCount: constraints.size,
      goalCount: goals.size,
      eventCount: events.size,
      violatedConstraintCount: violatedConstraintIds.length,
      activeGoalCount: activeGoalIds.length,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };

    return reply.status(200).send({
      success: true,
      data: status,
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.get("/world/entities", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { type, limit = 50, offset = 0 } = request.query as { type?: string; limit?: number; offset?: number };

    let result = Array.from(entities.values());
    if (type) {
      result = result.filter((e) => e.type === type);
    }

    const total = result.length;
    const paginated = result.slice(offset, offset + limit);

    return reply.status(200).send({
      success: true,
      data: {
        items: paginated,
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.get("/world/timeline", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { start, end, limit = 50, offset = 0 } = request.query as { start?: string; end?: string; limit?: number; offset?: number };

    let result = Array.from(events.values());
    if (start) {
      const startTime = new Date(start).getTime();
      result = result.filter((e) => new Date(e.timestamp).getTime() >= startTime);
    }
    if (end) {
      const endTime = new Date(end).getTime();
      result = result.filter((e) => new Date(e.timestamp).getTime() <= endTime);
    }

    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = result.length;
    const paginated = result.slice(offset, offset + limit);

    return reply.status(200).send({
      success: true,
      data: {
        events: paginated,
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.get("/world/constraints", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { status, type, limit = 50, offset = 0 } = request.query as { status?: string; type?: string; limit?: number; offset?: number };

    let result = Array.from(constraints.values());
    if (status) {
      result = result.filter((c) => c.status === status);
    }
    if (type) {
      result = result.filter((c) => c.type === type);
    }

    const total = result.length;
    const paginated = result.slice(offset, offset + limit);

    return reply.status(200).send({
      success: true,
      data: {
        items: paginated,
        violatedConstraints: violatedConstraintIds,
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.get("/world/goals", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { state, priority, limit = 50, offset = 0 } = request.query as { state?: string; priority?: number; limit?: number; offset?: number };

    let result = Array.from(goals.values());
    if (state) {
      result = result.filter((g) => g.state === state);
    }
    if (priority !== undefined) {
      result = result.filter((g) => g.priority === priority);
    }

    const total = result.length;
    const paginated = result.slice(offset, offset + limit);

    return reply.status(200).send({
      success: true,
      data: {
        items: paginated,
        activeGoals: activeGoalIds,
        completedGoals: completedGoalIds,
        failedGoals: failedGoalIds,
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.post<{ Body: { query: string; filters?: Record<string, unknown>; depth?: number } }>("/world/query", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: { query: string; filters?: Record<string, unknown>; depth?: number } }>, reply: FastifyReply) => {
    const { query, filters, depth = 1 } = request.body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Query string is required",
          details: { field: "query" },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    const startTime = Date.now();
    const queryLower = query.toLowerCase();

    const matchedEntities = Array.from(entities.values()).filter((e) =>
      e.name.toLowerCase().includes(queryLower) ||
      e.description.toLowerCase().includes(queryLower) ||
      e.tags.some((t) => t.toLowerCase().includes(queryLower))
    );

    const matchedEvents = Array.from(events.values()).filter((e) =>
      e.name.toLowerCase().includes(queryLower) ||
      e.description.toLowerCase().includes(queryLower)
    );

    const duration = Date.now() - startTime;

    wsManager.broadcast("world/update", {
      type: "query_executed",
      query,
      resultCount: matchedEntities.length + matchedEvents.length,
      duration,
    });

    logger.info("World query executed", { query, duration, resultCount: matchedEntities.length + matchedEvents.length });

    return reply.status(200).send({
      success: true,
      data: {
        query,
        entities: matchedEntities,
        events: matchedEvents,
        duration,
        depth,
        totalResults: matchedEntities.length + matchedEvents.length,
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString(), duration },
    });
  });
}
