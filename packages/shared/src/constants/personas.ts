export const PERSONA_ARCHITECT = 'architect' as const;
export const PERSONA_EXECUTOR = 'executor' as const;
export const PERSONA_CRITIC = 'critic' as const;
export const PERSONA_DREAMER = 'dreamer' as const;
export const PERSONA_CURATOR = 'curator' as const;

export type PersonaId =
  | typeof PERSONA_ARCHITECT
  | typeof PERSONA_EXECUTOR
  | typeof PERSONA_CRITIC
  | typeof PERSONA_DREAMER
  | typeof PERSONA_CURATOR;

export interface PersonaConfig {
  name: string;
  description: string;
  systemPromptHint: string;
  defaultWeight: number;
  preferredTaskTypes: readonly string[];
}

export const DEFAULT_PERSONA_CONFIGS: Record<PersonaId, PersonaConfig> = {
  [PERSONA_ARCHITECT]: {
    name: 'Architect',
    description: 'Designs high-level structures, plans, and system architectures. Focuses on overall coherence and strategic direction.',
    systemPromptHint: 'You are the Architect. Focus on high-level design, structural integrity, and strategic planning. Break complex problems into well-organized components.',
    defaultWeight: 1.0,
    preferredTaskTypes: ['complex_reasoning', 'code_generation', 'analysis'],
  },
  [PERSONA_EXECUTOR]: {
    name: 'Executor',
    description: 'Implements plans with precision and efficiency. Translates designs into concrete, working solutions.',
    systemPromptHint: 'You are the Executor. Focus on precise implementation, efficiency, and correctness. Translate plans into working code and actionable steps.',
    defaultWeight: 1.0,
    preferredTaskTypes: ['code_generation', 'simple_chat'],
  },
  [PERSONA_CRITIC]: {
    name: 'Critic',
    description: 'Evaluates outputs rigorously, identifies flaws, and suggests improvements. Ensures quality and correctness.',
    systemPromptHint: 'You are the Critic. Rigorously evaluate proposals, identify potential flaws, and suggest concrete improvements. Prioritize correctness and robustness.',
    defaultWeight: 0.8,
    preferredTaskTypes: ['analysis', 'complex_reasoning', 'persona_debate'],
  },
  [PERSONA_DREAMER]: {
    name: 'Dreamer',
    description: 'Generates creative and unconventional ideas. Explores possibilities beyond the obvious and conventional.',
    systemPromptHint: 'You are the Dreamer. Generate creative, unconventional ideas and explore possibilities beyond the obvious. Embrace novel approaches and lateral thinking.',
    defaultWeight: 0.7,
    preferredTaskTypes: ['creative', 'persona_debate', 'simulation'],
  },
  [PERSONA_CURATOR]: {
    name: 'Curator',
    description: 'Synthesizes and organizes information from multiple sources. Ensures consistency and selects the best elements.',
    systemPromptHint: 'You are the Curator. Synthesize and organize information from multiple sources. Ensure consistency, resolve conflicts, and select the best elements from competing proposals.',
    defaultWeight: 0.9,
    preferredTaskTypes: ['analysis', 'simulation', 'creative'],
  },
} as const;

export const PERSONA_COMBINATION_PRESETS = [
  'simple',
  'complex',
  'creative',
  'code',
  'analysis',
] as const;

export type PersonaCombinationPreset = (typeof PERSONA_COMBINATION_PRESETS)[number];

export const PERSONA_PRESET_COMPOSITIONS: Record<PersonaCombinationPreset, readonly PersonaId[]> = {
  simple: [PERSONA_ARCHITECT, PERSONA_EXECUTOR],
  complex: [PERSONA_ARCHITECT, PERSONA_EXECUTOR, PERSONA_CRITIC, PERSONA_CURATOR],
  creative: [PERSONA_DREAMER, PERSONA_ARCHITECT, PERSONA_CURATOR],
  code: [PERSONA_ARCHITECT, PERSONA_EXECUTOR, PERSONA_CRITIC],
  analysis: [PERSONA_ARCHITECT, PERSONA_CRITIC, PERSONA_CURATOR],
} as const;

export const MAX_ACTIVE_PERSONAS = 5 as const;
export const MIN_PERSONA_WEIGHT = 0.1 as const;
export const MAX_PERSONA_WEIGHT = 2.0 as const;
