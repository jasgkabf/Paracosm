import type { Persona, PersonaConfig, PersonaState, PersonaRole } from '@paracosm/shared';
import { generateId, createLogger } from '@paracosm/shared';

const logger = createLogger('Persona');

export function createPersona(config: PersonaConfig): Persona {
  const id = generateId();
  const now = new Date();
  const state: PersonaState = {
    personaId: id,
    active: config.activeByDefault,
    lastActivated: now,
    invocationCount: 0,
    successRate: 0,
    averageLatencyMs: 0,
    contextWindow: [],
  };
  return {
    id,
    config,
    state,
    createdAt: now,
    updatedAt: now,
  };
}

export function activatePersona(persona: Persona): Persona {
  return {
    ...persona,
    state: {
      ...persona.state,
      active: true,
      lastActivated: new Date(),
    },
    updatedAt: new Date(),
  };
}

export function deactivatePersona(persona: Persona): Persona {
  return {
    ...persona,
    state: {
      ...persona.state,
      active: false,
    },
    updatedAt: new Date(),
  };
}

export function recordPersonaInvocation(persona: Persona, success: boolean, latencyMs: number): Persona {
  const totalCount = persona.state.invocationCount + 1;
  const successCount = Math.round(persona.state.successRate * persona.state.invocationCount) + (success ? 1 : 0);
  const totalLatency = persona.state.averageLatencyMs * persona.state.invocationCount + latencyMs;
  return {
    ...persona,
    state: {
      ...persona.state,
      invocationCount: totalCount,
      successRate: successCount / totalCount,
      averageLatencyMs: totalLatency / totalCount,
    },
    updatedAt: new Date(),
  };
}

export function isPersonaSuitableForTask(persona: Persona, taskType: string, complexity: string): boolean {
  if (!persona.state.active) return false;
  const role = persona.config.role;
  const suitabilityMap: Record<string, string[]> = {
    architect: ['planning', 'design', 'architecture', 'structure'],
    executor: ['implementation', 'execution', 'coding', 'action'],
    critic: ['review', 'evaluation', 'critique', 'quality'],
    dreamer: ['creative', 'brainstorm', 'innovation', 'exploration'],
    curator: ['synthesis', 'organization', 'summary', 'integration'],
    explorer: ['research', 'discovery', 'investigation', 'search'],
    optimizer: ['performance', 'efficiency', 'optimization', 'refinement'],
    synthesizer: ['integration', 'combination', 'merge', 'synthesis'],
    guardian: ['security', 'safety', 'compliance', 'protection'],
    innovator: ['innovation', 'novelty', 'experiment', 'prototype'],
    analyst: ['analysis', 'data', 'insight', 'metrics'],
  };
  const suitableTasks = suitabilityMap[role] ?? [];
  if (suitableTasks.some((t) => taskType.toLowerCase().includes(t))) return true;
  if (complexity === 'high' && ['architect', 'critic', 'synthesizer'].includes(role)) return true;
  if (complexity === 'low' && ['executor', 'optimizer'].includes(role)) return true;
  return false;
}

export function getPersonaPriority(persona: Persona, taskType: string): number {
  let priority = persona.config.priority;
  if (isPersonaSuitableForTask(persona, taskType, 'medium')) {
    priority += 10;
  }
  priority += persona.state.successRate * 5;
  if (persona.state.invocationCount > 0) {
    const latencyPenalty = Math.min(persona.state.averageLatencyMs / 10000, 3);
    priority -= latencyPenalty;
  }
  return priority;
}
