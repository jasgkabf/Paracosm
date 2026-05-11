export const ROUTING_ADAPTIVE = 'adaptive' as const;
export const ROUTING_COST_FIRST = 'cost_first' as const;
export const ROUTING_QUALITY_FIRST = 'quality_first' as const;
export const ROUTING_SPEED_FIRST = 'speed_first' as const;

export type RoutingStrategy =
  | typeof ROUTING_ADAPTIVE
  | typeof ROUTING_COST_FIRST
  | typeof ROUTING_QUALITY_FIRST
  | typeof ROUTING_SPEED_FIRST;

export const TASK_TYPES = [
  'simple_chat',
  'code_generation',
  'complex_reasoning',
  'simulation',
  'persona_debate',
  'creative',
  'analysis',
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export interface RoutingRule {
  taskType: TaskType;
  preferredModels: readonly string[];
  fallbackModels: readonly string[];
  minContextWindow: number;
  requireVision: boolean;
  requireFunctionCalling: boolean;
  priority: number;
}

export const DEFAULT_ROUTING_RULES: readonly RoutingRule[] = [
  {
    taskType: 'simple_chat',
    preferredModels: ['gpt-4o-mini', 'claude-haiku-3-5-20241022', 'gemini-1.5-flash'],
    fallbackModels: ['gpt-4o', 'deepseek-chat'],
    minContextWindow: 4096,
    requireVision: false,
    requireFunctionCalling: false,
    priority: 0,
  },
  {
    taskType: 'code_generation',
    preferredModels: ['gpt-4o', 'claude-sonnet-4-20250514', 'deepseek-v3'],
    fallbackModels: ['gpt-4-turbo', 'gemini-1.5-pro'],
    minContextWindow: 32768,
    requireVision: false,
    requireFunctionCalling: true,
    priority: 10,
  },
  {
    taskType: 'complex_reasoning',
    preferredModels: ['claude-sonnet-4-20250514', 'gpt-4o', 'gemini-1.5-pro'],
    fallbackModels: ['gpt-4-turbo', 'deepseek-v3'],
    minContextWindow: 64000,
    requireVision: false,
    requireFunctionCalling: true,
    priority: 20,
  },
  {
    taskType: 'simulation',
    preferredModels: ['claude-sonnet-4-20250514', 'gpt-4o'],
    fallbackModels: ['gemini-1.5-pro', 'deepseek-v3'],
    minContextWindow: 64000,
    requireVision: false,
    requireFunctionCalling: true,
    priority: 15,
  },
  {
    taskType: 'persona_debate',
    preferredModels: ['claude-sonnet-4-20250514', 'gpt-4o', 'gemini-1.5-pro'],
    fallbackModels: ['deepseek-v3', 'gpt-4-turbo'],
    minContextWindow: 64000,
    requireVision: false,
    requireFunctionCalling: false,
    priority: 15,
  },
  {
    taskType: 'creative',
    preferredModels: ['claude-sonnet-4-20250514', 'gpt-4o', 'gemini-1.5-pro'],
    fallbackModels: ['deepseek-v3', 'gpt-4o-mini'],
    minContextWindow: 32768,
    requireVision: false,
    requireFunctionCalling: false,
    priority: 5,
  },
  {
    taskType: 'analysis',
    preferredModels: ['gpt-4o', 'claude-sonnet-4-20250514', 'gemini-1.5-pro'],
    fallbackModels: ['deepseek-v3', 'gpt-4-turbo'],
    minContextWindow: 64000,
    requireVision: true,
    requireFunctionCalling: true,
    priority: 20,
  },
] as const;

export const ROUTING_STRATEGY_WEIGHTS: Record<RoutingStrategy, { cost: number; quality: number; speed: number }> = {
  [ROUTING_ADAPTIVE]: { cost: 0.33, quality: 0.34, speed: 0.33 },
  [ROUTING_COST_FIRST]: { cost: 0.6, quality: 0.2, speed: 0.2 },
  [ROUTING_QUALITY_FIRST]: { cost: 0.2, quality: 0.6, speed: 0.2 },
  [ROUTING_SPEED_FIRST]: { cost: 0.2, quality: 0.2, speed: 0.6 },
} as const;

export const MAX_ROUTING_FALLBACK_DEPTH = 3 as const;
export const ROUTING_CACHE_TTL_MS = 300000 as const;
