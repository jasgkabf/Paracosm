import type { FastifyInstance } from "fastify";
import { WSManager } from "../websocket/ws-manager.js";
import { registerChatRoutes } from "./chat.js";
import { registerWorldModelRoutes } from "./world-model.js";
import { registerSimulationRoutes } from "./simulation.js";
import { registerStrategyRoutes } from "./strategy.js";
import { registerToolRoutes } from "./tools.js";
import { registerLLMConfigRoutes } from "./llm-config.js";
import { registerPersonaRoutes } from "./personas.js";
import { registerUserRoutes } from "./user.js";
import { registerHeartbeatRoutes } from "./heartbeat.js";
import { registerCustomLLMRoutes } from "./custom-llm.js";

export async function registerRoutes(fastify: FastifyInstance, wsManager: WSManager): Promise<void> {
  await fastify.register(
    async (instance) => {
      await registerChatRoutes(instance, wsManager);
      await registerWorldModelRoutes(instance, wsManager);
      await registerSimulationRoutes(instance, wsManager);
      await registerStrategyRoutes(instance, wsManager);
      await registerToolRoutes(instance, wsManager);
      await registerLLMConfigRoutes(instance, wsManager);
      await registerPersonaRoutes(instance, wsManager);
      await registerUserRoutes(instance, wsManager);
      await registerHeartbeatRoutes(instance, wsManager);
      await registerCustomLLMRoutes(instance, wsManager);
    },
    { prefix: "/api/v1" }
  );
}
