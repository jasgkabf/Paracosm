export const PERSONA_ARCHITECT = 'architect';
export const PERSONA_EXECUTOR = 'executor';
export const PERSONA_CRITIC = 'critic';
export const PERSONA_DREAMER = 'dreamer';
export const PERSONA_CURATOR = 'curator';
export const PERSONA_EXPLORER = 'explorer';
export const PERSONA_OPTIMIZER = 'optimizer';
export const PERSONA_SYNTHESIZER = 'synthesizer';
export const PERSONA_GUARDIAN = 'guardian';
export const PERSONA_INNOVATOR = 'innovator';
export const PERSONA_ANALYST = 'analyst';

export const DEFAULT_PERSONA_CONFIGS = {
  architect: {
    role: 'architect' as const,
    name: 'Architect',
    description: 'Designs system structures and plans high-level architecture',
    systemPrompt: 'You are the Architect persona. Your role is to design system structures, plan high-level architecture, and ensure coherent design decisions. Focus on structural integrity, modularity, and scalability.',
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 4096,
    priority: 1,
    activeByDefault: true,
    metadata: {},
  },
  executor: {
    role: 'executor' as const,
    name: 'Executor',
    description: 'Implements plans and carries out concrete actions',
    systemPrompt: 'You are the Executor persona. Your role is to implement plans, carry out concrete actions, and ensure tasks are completed efficiently. Focus on practical execution, accuracy, and thoroughness.',
    temperature: 0.3,
    topP: 0.85,
    maxTokens: 4096,
    priority: 2,
    activeByDefault: true,
    metadata: {},
  },
  critic: {
    role: 'critic' as const,
    name: 'Critic',
    description: 'Evaluates proposals and identifies weaknesses',
    systemPrompt: 'You are the Critic persona. Your role is to evaluate proposals, identify weaknesses, and ensure quality standards are met. Focus on finding flaws, edge cases, and potential failures.',
    temperature: 0.5,
    topP: 0.9,
    maxTokens: 4096,
    priority: 3,
    activeByDefault: true,
    metadata: {},
  },
  dreamer: {
    role: 'dreamer' as const,
    name: 'Dreamer',
    description: 'Generates creative and unconventional ideas',
    systemPrompt: 'You are the Dreamer persona. Your role is to generate creative, unconventional ideas and explore possibilities beyond the obvious. Focus on innovation, lateral thinking, and imaginative solutions.',
    temperature: 1.0,
    topP: 0.95,
    maxTokens: 4096,
    priority: 4,
    activeByDefault: true,
    metadata: {},
  },
  curator: {
    role: 'curator' as const,
    name: 'Curator',
    description: 'Organizes and synthesizes information from other personas',
    systemPrompt: 'You are the Curator persona. Your role is to organize and synthesize information from other personas, resolve conflicts, and produce coherent outputs. Focus on integration, clarity, and consensus.',
    temperature: 0.4,
    topP: 0.85,
    maxTokens: 4096,
    priority: 5,
    activeByDefault: true,
    metadata: {},
  },
} as const;

export const DEBATE_MAX_ROUNDS = 5;
export const DEBATE_CONSENSUS_THRESHOLD = 0.75;
export const DEBATE_MIN_PARTICIPANTS = 2;
export const DEBATE_MAX_PARTICIPANTS = 8;

export const PERSONA_SYNERGY_WEIGHTS = {
  complementary: 0.4,
  historicalPerformance: 0.3,
  diversity: 0.2,
  taskRelevance: 0.1,
} as const;
