import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createLogger, generateId } from "@paracosm/shared";
import type {
  HeartbeatEvent,
  EngineStatus,
  ProviderStatus,
} from "@paracosm/shared";
import { WSManager } from "../websocket/ws-manager.js";

const logger = createLogger("api:routes:heartbeat");

interface HeartbeatState {
  phase: string;
  bpm: number;
  rhythm: string;
  beatCount: number;
  uptime: number;
  lastBeatAt: string;
  nextBeatAt: string;
}

const heartbeatHistory: HeartbeatEvent[] = [];
const MAX_HISTORY_SIZE = 1000;

let beatCount = 0;
const startTime = Date.now();

function getHeartbeatState(): HeartbeatState {
  beatCount++;
  const uptime = (Date.now() - startTime) / 1000;
  const baseBpm = 60 + Math.sin(uptime / 30) * 10;
  const bpm = Math.round(baseBpm + (Math.random() - 0.5) * 4);
  return {
    phase: bpm > 80 ? "systole" : bpm > 60 ? "diastole" : "rest",
    bpm,
    rhythm: "normal_sinus",
    beatCount,
    uptime,
    lastBeatAt: new Date().toISOString(),
    nextBeatAt: new Date(Date.now() + 60000 / bpm).toISOString(),
  };
}

function getSystemVitals() {
  const mem = process.memoryUsage();
  return {
    cpuLoad: Math.min(1, Math.max(0, 0.1 + Math.random() * 0.5)),
    memoryPressure: mem.heapUsed / mem.heapTotal,
    diskPressure: 0.1 + Math.random() * 0.2,
    networkLatency: Math.floor(1 + Math.random() * 10),
    errorRate: Math.random() * 0.05,
    connectionLoad: Math.random() * 0.3,
    llmLoad: Math.random() * 0.4,
    engineLoad: Math.random() * 0.3,
    overallLoad: 0.1 + Math.random() * 0.4,
  };
}

function getEngineStatuses(): EngineStatus[] {
  return [
    { engineId: "world-model", name: "World Model Engine", status: "running", lastActivityAt: new Date().toISOString(), tasksCompleted: 150, tasksPending: 2, tasksFailed: 1, averageTaskDurationMs: 45, healthScore: 0.98 },
    { engineId: "simulation", name: "Simulation Engine", status: "idle", lastActivityAt: new Date(Date.now() - 60000).toISOString(), tasksCompleted: 25, tasksPending: 0, tasksFailed: 0, averageTaskDurationMs: 2500, healthScore: 1.0 },
    { engineId: "strategy", name: "Strategy Engine", status: "idle", lastActivityAt: new Date(Date.now() - 120000).toISOString(), tasksCompleted: 10, tasksPending: 0, tasksFailed: 0, averageTaskDurationMs: 5000, healthScore: 1.0 },
    { engineId: "tools", name: "Tool Engine", status: "running", lastActivityAt: new Date().toISOString(), tasksCompleted: 500, tasksPending: 1, tasksFailed: 3, averageTaskDurationMs: 120, healthScore: 0.95 },
    { engineId: "heartbeat", name: "Heartbeat Engine", status: "running", lastActivityAt: new Date().toISOString(), tasksCompleted: beatCount, tasksPending: 0, tasksFailed: 0, averageTaskDurationMs: 1, healthScore: 1.0 },
    { engineId: "persona-mesh", name: "Persona Mesh Engine", status: "idle", lastActivityAt: new Date(Date.now() - 300000).toISOString(), tasksCompleted: 5, tasksPending: 0, tasksFailed: 0, averageTaskDurationMs: 10000, healthScore: 1.0 },
  ];
}

function getProviderStatuses(): ProviderStatus[] {
  return [
    { providerId: "openai-default", providerName: "OpenAI", available: true, latencyMs: 150, errorRate: 0.001, quotaRemaining: 900, quotaLimit: 1000, lastRequestAt: new Date().toISOString(), circuitState: "closed" as const },
    { providerId: "anthropic-default", providerName: "Anthropic", available: true, latencyMs: 200, errorRate: 0.002, quotaRemaining: 800, quotaLimit: 1000, lastRequestAt: new Date(Date.now() - 30000).toISOString(), circuitState: "closed" as const },
    { providerId: "google-default", providerName: "Google", available: true, latencyMs: 180, errorRate: 0.001, quotaRemaining: 950, quotaLimit: 1000, lastRequestAt: new Date(Date.now() - 60000).toISOString(), circuitState: "closed" as const },
    { providerId: "deepseek-default", providerName: "DeepSeek", available: true, latencyMs: 300, errorRate: 0.005, quotaRemaining: 500, quotaLimit: 1000, lastRequestAt: new Date(Date.now() - 120000).toISOString(), circuitState: "closed" as const },
    { providerId: "ollama-default", providerName: "Ollama", available: false, latencyMs: 0, errorRate: 0, quotaRemaining: 0, quotaLimit: 0, lastRequestAt: "", circuitState: "open" as const },
  ];
}

function addToHistory(event: HeartbeatEvent): void {
  heartbeatHistory.push(event);
  if (heartbeatHistory.length > MAX_HISTORY_SIZE) {
    heartbeatHistory.shift();
  }
}

export async function registerHeartbeatRoutes(fastify: FastifyInstance, wsManager: WSManager): Promise<void> {
  fastify.get("/heartbeat/live", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const interval = setInterval(() => {
      try {
        const state = getHeartbeatState();
        const vitals = getSystemVitals();

        const beatData = {
          type: "heartbeat",
          timestamp: new Date().toISOString(),
          state,
          vitalSigns: vitals,
        };

        reply.raw.write(`data: ${JSON.stringify(beatData)}\n\n`);

        const event: HeartbeatEvent = {
          id: generateId(),
          type: "beat" as any,
          timestamp: new Date().toISOString(),
          description: `Heartbeat at ${state.bpm} BPM, phase: ${state.phase}`,
          severity: "info",
          metricName: "bpm",
          metricValue: state.bpm,
          threshold: null,
          action: null,
        };
        addToHistory(event);
      } catch (error) {
        logger.error("Heartbeat SSE error", error as Error);
        clearInterval(interval);
      }
    }, 1000);

    request.raw.on("close", () => {
      clearInterval(interval);
    });

    await new Promise(() => {});
  });

  fastify.get("/heartbeat/status", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const state = getHeartbeatState();
    const vitals = getSystemVitals();

    return reply.status(200).send({
      success: true,
      data: {
        state,
        vitals,
        timestamp: new Date().toISOString(),
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.get("/heartbeat/history", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit = 50, offset = 0, severity } = request.query as { limit?: number; offset?: number; severity?: string };

    let events = [...heartbeatHistory];

    if (severity) {
      events = events.filter((e) => e.severity === severity);
    }

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = events.length;
    const paginated = events.slice(offset, offset + limit);

    const warningCount = heartbeatHistory.filter((e) => e.severity === "warning").length;
    const criticalCount = heartbeatHistory.filter((e) => e.severity === "critical").length;
    const errorCount = heartbeatHistory.filter((e) => e.severity === "critical").length;

    return reply.status(200).send({
      success: true,
      data: {
        events: paginated,
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
        summary: {
          totalBeats: heartbeatHistory.length,
          warningCount,
          criticalCount,
          errorCount,
        },
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.get("/heartbeat/engines", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const engines = getEngineStatuses();

    return reply.status(200).send({
      success: true,
      data: {
        engines,
        total: engines.length,
        healthy: engines.filter((e) => e.status === "running" || e.status === "idle").length,
        unhealthy: engines.filter((e) => e.status === "error").length,
        timestamp: new Date().toISOString(),
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.get("/heartbeat/providers", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const providerStatuses = getProviderStatuses();

    return reply.status(200).send({
      success: true,
      data: {
        providers: providerStatuses,
        total: providerStatuses.length,
        available: providerStatuses.filter((p) => p.available).length,
        unavailable: providerStatuses.filter((p) => !p.available).length,
        timestamp: new Date().toISOString(),
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });
}
