import type { Persona, PersonaConfig, PersonaRole } from '@paracosm/shared';
import { PERSONA_EXECUTOR, DEFAULT_PERSONA_CONFIGS } from '@paracosm/shared';
import { createPersona } from '../persona.js';

export class ExecutorPersona {
  static readonly role: PersonaRole = PERSONA_EXECUTOR;
  static readonly config: PersonaConfig = DEFAULT_PERSONA_CONFIGS[PERSONA_EXECUTOR];

  static create(): Persona {
    return createPersona(ExecutorPersona.config);
  }

  static getSystemPrompt(): string {
    return ExecutorPersona.config.systemPrompt;
  }

  static createExecutionPlan(steps: string[]): { orderedSteps: string[]; estimatedDurations: number[]; prerequisites: string[][] } {
    const orderedSteps = [...steps];
    const estimatedDurations: number[] = steps.map((step) => {
      const complexity = step.length > 100 ? 3 : step.length > 50 ? 2 : 1;
      return complexity * 5000;
    });
    const prerequisites: string[][] = steps.map((_, index) => {
      if (index === 0) return [];
      return [steps[index - 1]];
    });
    return { orderedSteps, estimatedDurations, prerequisites };
  }

  static validateExecution(result: string, criteria: string[]): { valid: boolean; issues: string[]; score: number } {
    const issues: string[] = [];
    let score = 1.0;
    for (const criterion of criteria) {
      if (!result.toLowerCase().includes(criterion.toLowerCase())) {
        issues.push(`Missing criterion: ${criterion}`);
        score -= 0.2;
      }
    }
    if (result.length < 10) {
      issues.push('Result is too short to be meaningful');
      score -= 0.3;
    }
    return { valid: issues.length === 0, issues, score: Math.max(score, 0) };
  }

  static estimateEffort(task: string, complexity: 'low' | 'medium' | 'high'): { timeMs: number; tokens: number; steps: number } {
    const baseTime = { low: 5000, medium: 15000, high: 60000 };
    const baseTokens = { low: 500, medium: 2000, high: 8000 };
    const baseSteps = { low: 2, medium: 5, high: 10 };
    const timeMs = baseTime[complexity] * (1 + task.length * 0.001);
    const tokens = Math.ceil(baseTokens[complexity] * (1 + task.length * 0.005));
    const steps = baseSteps[complexity];
    return { timeMs, tokens, steps };
  }
}
