import type { Persona, PersonaConfig, PersonaRole } from '@paracosm/shared';
import { PERSONA_ARCHITECT, DEFAULT_PERSONA_CONFIGS } from '@paracosm/shared';
import { createPersona } from '../persona.js';

export class ArchitectPersona {
  static readonly role: PersonaRole = PERSONA_ARCHITECT;
  static readonly config: PersonaConfig = DEFAULT_PERSONA_CONFIGS[PERSONA_ARCHITECT];

  static create(): Persona {
    return createPersona(ArchitectPersona.config);
  }

  static getSystemPrompt(): string {
    return ArchitectPersona.config.systemPrompt;
  }

  static analyzeStructure(context: string): { observations: string[]; recommendations: string[]; concerns: string[] } {
    const observations: string[] = [];
    const recommendations: string[] = [];
    const concerns: string[] = [];
    if (context.length > 1000) {
      observations.push('Complex context with significant scope');
      recommendations.push('Consider decomposing into modular components');
    }
    if (context.includes('dependency') || context.includes('depend')) {
      concerns.push('Dependency management requires careful attention');
      recommendations.push('Map dependency graph and identify critical paths');
    }
    if (context.includes('scale') || context.includes('performance')) {
      recommendations.push('Design for horizontal scalability from the start');
      observations.push('Scalability requirements detected');
    }
    if (context.includes('integration') || context.includes('api')) {
      recommendations.push('Define clear interface contracts before implementation');
      observations.push('Integration points identified');
    }
    observations.push('Context analyzed for structural patterns');
    return { observations, recommendations, concerns };
  }

  static designPlan(requirements: string[], constraints: string[]): { phases: string[]; dependencies: Array<{ from: number; to: number }>; riskAreas: string[] } {
    const phases: string[] = [];
    const dependencies: Array<{ from: number; to: number }> = [];
    const riskAreas: string[] = [];
    phases.push('Requirements analysis and validation');
    phases.push('Architecture design and component identification');
    phases.push('Interface contract definition');
    phases.push('Implementation planning and sequencing');
    phases.push('Integration strategy and testing approach');
    dependencies.push({ from: 0, to: 1 });
    dependencies.push({ from: 1, to: 2 });
    dependencies.push({ from: 2, to: 3 });
    dependencies.push({ from: 3, to: 4 });
    if (constraints.length > 3) {
      riskAreas.push('High constraint count may limit design flexibility');
    }
    if (requirements.some((r) => r.toLowerCase().includes('real-time'))) {
      riskAreas.push('Real-time requirements need careful performance planning');
    }
    return { phases, dependencies, riskAreas };
  }
}
