import type { Persona, PersonaConfig, PersonaRole } from '@paracosm/shared';
import { PERSONA_DREAMER, DEFAULT_PERSONA_CONFIGS } from '@paracosm/shared';
import { createPersona } from '../persona.js';

export class DreamerPersona {
  static readonly role: PersonaRole = PERSONA_DREAMER;
  static readonly config: PersonaConfig = DEFAULT_PERSONA_CONFIGS[PERSONA_DREAMER];

  static create(): Persona {
    return createPersona(DreamerPersona.config);
  }

  static getSystemPrompt(): string {
    return DreamerPersona.config.systemPrompt;
  }

  static brainstorm(topic: string, constraints: string[] = []): { ideas: string[]; novelApproaches: string[]; expandedConcepts: string[] } {
    const ideas: string[] = [];
    const novelApproaches: string[] = [];
    const expandedConcepts: string[] = [];
    ideas.push(`Rethink ${topic} from first principles`);
    ideas.push(`Apply cross-domain analogy to ${topic}`);
    ideas.push(`Invert the problem: what would make ${topic} worse, then reverse`);
    if (constraints.length === 0) {
      ideas.push(`Explore unconstrained possibilities for ${topic}`);
      novelApproaches.push('Remove all assumed limitations and redesign from scratch');
    } else {
      ideas.push(`Use constraints as creative catalysts for ${topic}`);
      novelApproaches.push('Turn each constraint into a feature');
    }
    novelApproaches.push(`Combine ${topic} with emerging technologies`);
    novelApproaches.push(`Apply biomimicry principles to ${topic}`);
    expandedConcepts.push(`What if ${topic} could adapt autonomously?`);
    expandedConcepts.push(`What if ${topic} were decentralized and self-organizing?`);
    expandedConcepts.push(`What if ${topic} learned and evolved over time?`);
    return { ideas, novelApproaches, expandedConcepts };
  }

  static generateAlternatives(currentApproach: string, count: number = 3): string[] {
    const alternatives: string[] = [];
    const prefixes = [
      'What if instead we',
      'An alternative approach could',
      'Consider a different angle:',
      'A radical departure would be to',
      'Looking at this differently, we could',
    ];
    for (let i = 0; i < count; i++) {
      const prefix = prefixes[i % prefixes.length];
      alternatives.push(`${prefix} rethink ${currentApproach} with a focus on ${['simplicity', 'scalability', 'innovation', 'resilience', 'elegance'][i % 5]}`);
    }
    return alternatives;
  }
}
