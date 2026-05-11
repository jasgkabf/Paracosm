import type { Persona, PersonaConfig, PersonaRole } from '@paracosm/shared';
import { PERSONA_CURATOR, DEFAULT_PERSONA_CONFIGS } from '@paracosm/shared';
import { createPersona } from '../persona.js';

export class CuratorPersona {
  static readonly role: PersonaRole = PERSONA_CURATOR;
  static readonly config: PersonaConfig = DEFAULT_PERSONA_CONFIGS[PERSONA_CURATOR];

  static create(): Persona {
    return createPersona(CuratorPersona.config);
  }

  static getSystemPrompt(): string {
    return CuratorPersona.config.systemPrompt;
  }

  static synthesize(inputs: Array<{ source: string; content: string; confidence: number }>): { summary: string; keyPoints: string[]; conflicts: string[]; consensus: string } {
    const keyPoints: string[] = [];
    const conflicts: string[] = [];
    const highConfidenceInputs = inputs.filter((i) => i.confidence >= 0.7);
    for (const input of highConfidenceInputs) {
      const sentences = input.content.split(/[.!?]+/).filter((s) => s.trim().length > 10);
      keyPoints.push(...sentences.slice(0, 3));
    }
    const uniquePoints = [...new Set(keyPoints.map((p) => p.trim()))].slice(0, 10);
    const contentMap = new Map<string, string[]>();
    for (const input of inputs) {
      const keywords = input.content.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
      for (const keyword of keywords) {
        const sources = contentMap.get(keyword) ?? [];
        if (!sources.includes(input.source)) sources.push(input.source);
        contentMap.set(keyword, sources);
      }
    }
    for (const [keyword, sources] of contentMap) {
      if (sources.length >= 2) {
        const relevantInputs = inputs.filter((i) => i.content.toLowerCase().includes(keyword));
        const sentiments = relevantInputs.map((i) => i.confidence);
        const maxDiff = Math.max(...sentiments) - Math.min(...sentiments);
        if (maxDiff > 0.4) {
          conflicts.push(`Disagreement on "${keyword}" across sources: ${sources.join(', ')}`);
        }
      }
    }
    const summary = uniquePoints.length > 0
      ? `Synthesis of ${inputs.length} sources: ${uniquePoints.slice(0, 3).join('. ')}.`
      : 'Insufficient data for meaningful synthesis.';
    const consensus = conflicts.length === 0
      ? 'All sources are in general agreement.'
      : `${conflicts.length} areas of disagreement identified requiring resolution.`;
    return { summary, keyPoints: uniquePoints, conflicts, consensus };
  }

  static organize(items: Array<{ id: string; category?: string; priority?: number }>): Map<string, Array<{ id: string; priority: number }>> {
    const organized = new Map<string, Array<{ id: string; priority: number }>>();
    for (const item of items) {
      const category = item.category ?? 'uncategorized';
      const list = organized.get(category) ?? [];
      list.push({ id: item.id, priority: item.priority ?? 5 });
      organized.set(category, list);
    }
    for (const [, list] of organized) {
      list.sort((a, b) => b.priority - a.priority);
    }
    return organized;
  }
}
