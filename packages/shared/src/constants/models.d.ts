export declare const MODEL_GPT4O: "gpt-4o";
export declare const MODEL_GPT4O_MINI: "gpt-4o-mini";
export declare const MODEL_GPT4_TURBO: "gpt-4-turbo";
export declare const MODEL_GPT35_TURBO: "gpt-3.5-turbo";
export declare const MODEL_CLAUDE_OPUS: "claude-3-opus-20240229";
export declare const MODEL_CLAUDE_SONNET: "claude-3-5-sonnet-20241022";
export declare const MODEL_CLAUDE_HAIKU: "claude-3-haiku-20240307";
export declare const MODEL_GEMINI_PRO: "gemini-1.5-pro";
export declare const MODEL_GEMINI_FLASH: "gemini-1.5-flash";
export declare const MODEL_MISTRAL_LARGE: "mistral-large-latest";
export declare const MODEL_MISTRAL_MEDIUM: "mistral-medium-latest";
export declare const MODEL_MISTRAL_SMALL: "mistral-small-latest";
export interface ModelCapability {
    contextWindow: number;
    maxOutputTokens: number;
    streaming: boolean;
    functionCalling: boolean;
    vision: boolean;
    costPer1kInput: number;
    costPer1kOutput: number;
}
export declare const MODEL_CAPABILITIES: Record<string, ModelCapability>;
export declare const MODEL_PRICING: {
    [k: string]: {
        inputPer1k: number;
        outputPer1k: number;
    };
};
//# sourceMappingURL=models.d.ts.map