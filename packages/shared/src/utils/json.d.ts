export declare function safeParse<T>(json: string, fallback: T): T;
export declare function safeStringify(value: unknown, replacer?: (key: string, value: unknown) => unknown, space?: number): string;
export declare function deepClone<T>(value: T): T;
export declare function merge<T extends Record<string, unknown>>(target: T, ...sources: Partial<T>[]): T;
export declare function deepMerge<T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T;
export declare function pick<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>;
export declare function omit<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>;
//# sourceMappingURL=json.d.ts.map