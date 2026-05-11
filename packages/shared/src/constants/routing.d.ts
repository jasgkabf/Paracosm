export declare const ROUTING_ROUND_ROBIN: "round_robin";
export declare const ROUTING_LEAST_LATENCY: "least_latency";
export declare const ROUTING_COST_OPTIMIZED: "cost_optimized";
export declare const ROUTING_QUALITY_OPTIMIZED: "quality_optimized";
export declare const ROUTING_ADAPTIVE: "adaptive";
export declare const ROUTING_MANUAL: "manual";
export declare const TASK_TYPES: {
    readonly CODE_GENERATION: "code_generation";
    readonly CODE_REVIEW: "code_review";
    readonly ANALYSIS: "analysis";
    readonly SUMMARIZATION: "summarization";
    readonly TRANSLATION: "translation";
    readonly CREATIVE_WRITING: "creative_writing";
    readonly REASONING: "reasoning";
    readonly PLANNING: "planning";
    readonly EXTRACTION: "extraction";
    readonly CLASSIFICATION: "classification";
    readonly EMBEDDING: "embedding";
    readonly CHAT: "chat";
};
export declare const DEFAULT_ROUTING_RULES: {
    id: string;
    name: string;
    condition: string;
    provider: string;
    model: string;
    priority: number;
    enabled: boolean;
}[];
//# sourceMappingURL=routing.d.ts.map