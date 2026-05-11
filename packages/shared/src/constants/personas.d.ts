export declare const PERSONA_ARCHITECT = "architect";
export declare const PERSONA_EXECUTOR = "executor";
export declare const PERSONA_CRITIC = "critic";
export declare const PERSONA_DREAMER = "dreamer";
export declare const PERSONA_CURATOR = "curator";
export declare const PERSONA_EXPLORER = "explorer";
export declare const PERSONA_OPTIMIZER = "optimizer";
export declare const PERSONA_SYNTHESIZER = "synthesizer";
export declare const PERSONA_GUARDIAN = "guardian";
export declare const PERSONA_INNOVATOR = "innovator";
export declare const PERSONA_ANALYST = "analyst";
export declare const DEFAULT_PERSONA_CONFIGS: {
    readonly architect: {
        readonly role: "architect";
        readonly name: "Architect";
        readonly description: "Designs system structures and plans high-level architecture";
        readonly systemPrompt: "You are the Architect persona. Your role is to design system structures, plan high-level architecture, and ensure coherent design decisions. Focus on structural integrity, modularity, and scalability.";
        readonly temperature: 0.7;
        readonly topP: 0.9;
        readonly maxTokens: 4096;
        readonly priority: 1;
        readonly activeByDefault: true;
        readonly metadata: {};
    };
    readonly executor: {
        readonly role: "executor";
        readonly name: "Executor";
        readonly description: "Implements plans and carries out concrete actions";
        readonly systemPrompt: "You are the Executor persona. Your role is to implement plans, carry out concrete actions, and ensure tasks are completed efficiently. Focus on practical execution, accuracy, and thoroughness.";
        readonly temperature: 0.3;
        readonly topP: 0.85;
        readonly maxTokens: 4096;
        readonly priority: 2;
        readonly activeByDefault: true;
        readonly metadata: {};
    };
    readonly critic: {
        readonly role: "critic";
        readonly name: "Critic";
        readonly description: "Evaluates proposals and identifies weaknesses";
        readonly systemPrompt: "You are the Critic persona. Your role is to evaluate proposals, identify weaknesses, and ensure quality standards are met. Focus on finding flaws, edge cases, and potential failures.";
        readonly temperature: 0.5;
        readonly topP: 0.9;
        readonly maxTokens: 4096;
        readonly priority: 3;
        readonly activeByDefault: true;
        readonly metadata: {};
    };
    readonly dreamer: {
        readonly role: "dreamer";
        readonly name: "Dreamer";
        readonly description: "Generates creative and unconventional ideas";
        readonly systemPrompt: "You are the Dreamer persona. Your role is to generate creative, unconventional ideas and explore possibilities beyond the obvious. Focus on innovation, lateral thinking, and imaginative solutions.";
        readonly temperature: 1;
        readonly topP: 0.95;
        readonly maxTokens: 4096;
        readonly priority: 4;
        readonly activeByDefault: true;
        readonly metadata: {};
    };
    readonly curator: {
        readonly role: "curator";
        readonly name: "Curator";
        readonly description: "Organizes and synthesizes information from other personas";
        readonly systemPrompt: "You are the Curator persona. Your role is to organize and synthesize information from other personas, resolve conflicts, and produce coherent outputs. Focus on integration, clarity, and consensus.";
        readonly temperature: 0.4;
        readonly topP: 0.85;
        readonly maxTokens: 4096;
        readonly priority: 5;
        readonly activeByDefault: true;
        readonly metadata: {};
    };
};
export declare const DEBATE_MAX_ROUNDS = 5;
export declare const DEBATE_CONSENSUS_THRESHOLD = 0.75;
export declare const DEBATE_MIN_PARTICIPANTS = 2;
export declare const DEBATE_MAX_PARTICIPANTS = 8;
export declare const PERSONA_SYNERGY_WEIGHTS: {
    readonly complementary: 0.4;
    readonly historicalPerformance: 0.3;
    readonly diversity: 0.2;
    readonly taskRelevance: 0.1;
};
//# sourceMappingURL=personas.d.ts.map