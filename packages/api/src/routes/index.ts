import type { FastifyInstance } from 'fastify';
import type { WebSocketManager } from '../websocket/ws-manager.js';
import type { AgentEngine } from '../agent/agent-engine.js';
import { registerChatRoutes } from './chat.js';
import { registerWorldModelRoutes } from './world-model.js';
import { registerSimulationRoutes } from './simulation.js';
import { registerStrategyRoutes } from './strategy.js';
import { registerToolRoutes } from './tools.js';
import { registerLLMConfigRoutes } from './llm-config.js';
import { registerPersonaRoutes } from './personas.js';
import { registerUserRoutes } from './user.js';
import { registerHeartbeatRoutes } from './heartbeat.js';
import { registerCustomLLMRoutes } from './custom-llm.js';

export function registerRoutes(fastify: FastifyInstance, wsManager: WebSocketManager, agentEngine: AgentEngine): void {
  fastify.register(async (instance) => {
    instance.get('/', async () => ({
      name: 'Paracosm API',
      version: '0.1.0',
      endpoints: [
        '/chat',
        '/world-model',
        '/simulation',
        '/strategy',
        '/tools',
        '/llm-config',
        '/personas',
        '/user',
        '/heartbeat',
        '/custom-llm',
      ],
    }));
  });

  fastify.register(async (apiV1) => {
    registerChatRoutes(apiV1, agentEngine);
    registerWorldModelRoutes(apiV1);
    registerSimulationRoutes(apiV1);
    registerStrategyRoutes(apiV1);
    registerToolRoutes(apiV1);
    registerLLMConfigRoutes(apiV1, agentEngine);
    registerPersonaRoutes(apiV1);
    registerUserRoutes(apiV1);
    registerHeartbeatRoutes(apiV1);
    registerCustomLLMRoutes(apiV1);

    apiV1.get('/ws', { websocket: true }, (socket, _request) => {
      wsManager.handleConnection(socket);
    });
  }, { prefix: '/api/v1' });
}
