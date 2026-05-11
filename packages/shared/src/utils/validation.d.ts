export declare function validateConfig<T extends Record<string, unknown>>(config: unknown, requiredKeys: string[]): config is T;
export declare function validateAPIKey(key: string): boolean;
export declare function isNonEmptyString(value: unknown): value is string;
export declare function isPositiveNumber(value: unknown): value is number;
export declare function isValidUrl(value: string): boolean;
export declare function isValidPort(value: number): boolean;
export declare function clamp(value: number, min: number, max: number): number;
//# sourceMappingURL=validation.d.ts.map