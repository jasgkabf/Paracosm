import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createLogger, generateId } from "@paracosm/shared";
import { PersonaState } from "@paracosm/shared";
import type { PersonaId } from "@paracosm/shared";
import {
  DEFAULT_PERSONA_CONFIGS,
  PERSONA_COMBINATION_PRESETS,
  PERSONA_PRESET_COMPOSITIONS,
  MAX_ACTIVE_PERSONAS,
} from "@paracosm/shared";
import { WSManager } from "../websocket/ws-manager.js";

const logger = createLogger("api:routes:personas");

interface PersonaConfigBody {
  personaIds?: string[];
  debateRounds?: number;
  consensusThreshold?: number;
  timeLimitMs?: number;
  allowDissent?: boolean;
  minParticipants?: number;
  maxParticipants?: number;
  preset?: string;
}

interface StoredPersona {
  id: string;
  name: string;
  role: string;
  description: string;
  traits: string[];
  biases: string[];
  expertise: string[];
  communicationStyle: string;
  createdAt: string;
  updatedAt: string;
}

interface ActivePersona {
  personaId: string;
  state: PersonaState;
  activatedAt: string;
  context: string;
  energyLevel: number;
}

const personaList: StoredPersona[] = [];
const activePersonas = new Map<string, ActivePersona>();

function seedPersonas(): void {
  for (const [id, config] of Object.entries(DEFAULT_PERSONA_CONFIGS)) {
    personaList.push({
      id,
      name: config.name,
      role: id,
      description: config.description,
      traits: [config.systemPromptHint.substring(0, 50)],
      biases: [],
      expertise: [...config.preferredTaskTypes],
      communicationStyle: "analytical",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

seedPersonas();

export async function registerPersonaRoutes(fastify: FastifyInstance, wsManager: WSManager): Promise<void> {
  fastify.get("/personas/list", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const presets = Object.entries(PERSONA_PRESET_COMPOSITIONS).map(([key, ids]) => ({
      id: key,
      name: key,
      personaIds: ids,
      description: `Preset combination: ${key}`,
    }));

    return reply.status(200).send({
      success: true,
      data: {
        personas: personaList,
        presets,
        total: personaList.length,
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.get("/personas/active", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const active = Array.from(activePersonas.values());

    return reply.status(200).send({
      success: true,
      data: {
        items: active,
        total: active.length,
        maxActive: MAX_ACTIVE_PERSONAS,
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.put<{ Body: PersonaConfigBody }>("/personas/config", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: PersonaConfigBody }>, reply: FastifyReply) => {
    const {
      personaIds,
      debateRounds,
      consensusThreshold,
      timeLimitMs,
      allowDissent,
      minParticipants,
      maxParticipants,
      preset,
    } = request.body;

    let resolvedPersonaIds = personaIds;

    if (preset) {
      const presetComposition = PERSONA_PRESET_COMPOSITIONS[preset as keyof typeof PERSONA_PRESET_COMPOSITIONS];
      if (!presetComposition) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: `Unknown preset: ${preset}`,
            details: {
              field: "preset",
              value: preset,
              availablePresets: Object.keys(PERSONA_PRESET_COMPOSITIONS),
            },
          },
          meta: { requestId: request.id, timestamp: new Date().toISOString() },
        });
      }
      resolvedPersonaIds = [...presetComposition];
    }

    if (resolvedPersonaIds && resolvedPersonaIds.length > MAX_ACTIVE_PERSONAS) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: `Maximum ${MAX_ACTIVE_PERSONAS} personas can be active simultaneously`,
          details: { field: "personaIds", count: resolvedPersonaIds.length, max: MAX_ACTIVE_PERSONAS },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    if (resolvedPersonaIds) {
      const validIds = new Set(personaList.map((p) => p.id));
      for (const pid of resolvedPersonaIds) {
        if (!validIds.has(pid)) {
          return reply.status(404).send({
            success: false,
            error: {
              code: "NOT_FOUND",
              message: `Persona ${pid} not found`,
              details: { personaId: pid },
            },
            meta: { requestId: request.id, timestamp: new Date().toISOString() },
          });
        }
      }
    }

    activePersonas.clear();
    if (resolvedPersonaIds) {
      for (const pid of resolvedPersonaIds) {
        activePersonas.set(pid, {
          personaId: pid,
          state: PersonaState.Idle,
          activatedAt: new Date().toISOString(),
          context: "configured",
          energyLevel: 1.0,
        });
      }
    }

    wsManager.broadcast("system/notification", {
      type: "personas_configured",
      personaIds: resolvedPersonaIds ?? [],
      preset: preset ?? null,
      config: {
        debateRounds: debateRounds ?? 3,
        consensusThreshold: consensusThreshold ?? 0.7,
      },
    });

    logger.info("Persona configuration updated", {
      personaIds: resolvedPersonaIds,
      preset,
      debateRounds: debateRounds ?? 3,
    });

    return reply.status(200).send({
      success: true,
      data: {
        configured: true,
        personaIds: resolvedPersonaIds ?? [],
        preset: preset ?? null,
        config: {
          personaIds: resolvedPersonaIds ?? [],
          debateRounds: debateRounds ?? 3,
          consensusThreshold: consensusThreshold ?? 0.7,
          timeLimitMs: timeLimitMs ?? 60000,
          allowDissent: allowDissent ?? true,
          minParticipants: minParticipants ?? 2,
          maxParticipants: maxParticipants ?? MAX_ACTIVE_PERSONAS,
        },
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });
}
