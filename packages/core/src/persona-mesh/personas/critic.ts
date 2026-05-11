import type { Persona, PersonaConfig, PersonaRole } from '@paracosm/shared';
import { PERSONA_CRITIC, DEFAULT_PERSONA_CONFIGS } from '@paracosm/shared';
import { createPersona } from '../persona.js';

export class CriticPersona {
  static readonly role: PersonaRole = PERSONA_CRITIC;
  static readonly config: PersonaConfig = DEFAULT_PERSONA_CONFIGS[PERSONA_CRITIC];

  static create(): Persona {
    return createPersona(CriticPersona.config);
  }

  static getSystemPrompt(): string {
    return CriticPersona.config.systemPrompt;
  }

  static critique(proposal: string, context?: string): { strengths: string[]; weaknesses: string[]; suggestions: string[]; severity: number } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const suggestions: string[] = [];
    let severity = 0;
    if (proposal.length < 50) {
      weaknesses.push('Proposal lacks sufficient detail');
      severity += 3;
    } else {
      strengths.push('Proposal provides adequate detail');
    }
    if (!proposal.includes('error') && !proposal.includes('fail') && !proposal.includes('risk')) {
      weaknesses.push('No error handling or failure scenarios addressed');
      suggestions.push('Add error handling and failure mode analysis');
      severity += 2;
    }
    if (proposal.includes('assume') || proposal.includes('assuming')) {
      weaknesses.push('Contains unverified assumptions');
      suggestions.push('Validate assumptions before proceeding');
      severity += 2;
    }
    if (context && !proposal.toLowerCase().includes(context.toLowerCase().substring(0, 20))) {
      weaknesses.push('Proposal may not fully address the given context');
      severity += 1;
    }
    strengths.push('Proposal has been submitted for review');
    if (weaknesses.length === 0) {
      strengths.push('No significant weaknesses identified');
    }
    return { strengths, weaknesses, suggestions, severity: Math.min(severity, 10) };
  }

  static evaluateRisk(factors: string[]): { level: 'low' | 'medium' | 'high' | 'critical'; score: number; mitigations: string[] } {
    const mitigations: string[] = [];
    let score = 0;
    for (const factor of factors) {
      const lower = factor.toLowerCase();
      if (lower.includes('security') || lower.includes('vulnerability')) {
        score += 4;
        mitigations.push('Implement security review and penetration testing');
      } else if (lower.includes('performance') || lower.includes('latency')) {
        score += 3;
        mitigations.push('Conduct performance benchmarking and load testing');
      } else if (lower.includes('compatibility') || lower.includes('migration')) {
        score += 2;
        mitigations.push('Plan backward compatibility and migration path');
      } else {
        score += 1;
      }
    }
    const level = score >= 10 ? 'critical' : score >= 6 ? 'high' : score >= 3 ? 'medium' : 'low';
    return { level, score, mitigations };
  }
}
