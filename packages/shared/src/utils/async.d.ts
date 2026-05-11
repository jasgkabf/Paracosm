export declare function retry<T>(fn: () => Promise<T>, options?: {
    maxRetries?: number;
    delay?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: Error) => boolean;
}): Promise<T>;
export declare function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number, message?: string): Promise<T>;
export declare function concurrent<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]>;
export declare function semaphore(limit: number): {
    acquire: () => Promise<() => void>;
};
export declare function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delayMs: number): (...args: Parameters<T>) => void;
export declare function throttle<T extends (...args: unknown[]) => unknown>(fn: T, limitMs: number): (...args: Parameters<T>) => void;
export declare function sleep(ms: number): Promise<void>;
export declare function createDeferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
};
//# sourceMappingURL=async.d.ts.map