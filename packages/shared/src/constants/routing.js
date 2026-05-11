export const ROUTING_ROUND_ROBIN = 'round_robin';
export const ROUTING_LEAST_LATENCY = 'least_latency';
export const ROUTING_COST_OPTIMIZED = 'cost_optimized';
export const ROUTING_QUALITY_OPTIMIZED = 'quality_optimized';
export const ROUTING_ADAPTIVE = 'adaptive';
export const ROUTING_MANUAL = 'manual';
export const TASK_TYPES = {
    CODE_GENERATION: 'code_generation',
    CODE_REVIEW: 'code_review',
    ANALYSIS: 'analysis',
    SUMMARIZATION: 'summarization',
    TRANSLATION: 'translation',
    CREATIVE_WRITING: 'creative_writing',
    REASONING: 'reasoning',
    PLANNING: 'planning',
    EXTRACTION: 'extraction',
    CLASSIFICATION: 'classification',
    EMBEDDING: 'embedding',
    CHAT: 'chat',
};
export const DEFAULT_ROUTING_RULES = [
    {
        id: 'rule-code-gen',
        name: 'Code Generation',
        condition: 'taskType === "code_generation"',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        priority: 1,
        enabled: true,
    },
    {
        id: 'rule-analysis',
        name: 'Analysis',
        condition: 'taskType === "analysis"',
        provider: 'openai',
        model: 'gpt-4o',
        priority: 1,
        enabled: true,
    },
    {
        id: 'rule-reasoning',
        name: 'Reasoning',
        condition: 'taskType === "reasoning"',
        provider: 'openai',
        model: 'gpt-4o',
        priority: 1,
        enabled: true,
    },
    {
        id: 'rule-chat',
        name: 'Chat',
        condition: 'taskType === "chat"',
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        priority: 1,
        enabled: true,
    },
    {
        id: 'rule-summarization',
        name: 'Summarization',
        condition: 'taskType === "summarization"',
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        priority: 1,
        enabled: true,
    },
    {
        id: 'rule-creative',
        name: 'Creative Writing',
        condition: 'taskType === "creative_writing"',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        priority: 1,
        enabled: true,
    },
    {
        id: 'rule-fallback',
        name: 'Default Fallback',
        condition: 'true',
        provider: 'openai',
        model: 'gpt-4o-mini',
        priority: 99,
        enabled: true,
    },
];
//# sourceMappingURL=routing.js.map