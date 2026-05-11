export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

export interface Semaphore {
  acquire(): Promise<void>;
  release(): void;
}

export interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const delayMs = options.delayMs ?? 1000;
  const backoffMultiplier = options.backoffMultiplier ?? 2;
  const maxDelayMs = options.maxDelayMs ?? 30000;
  const shouldRetry = options.shouldRetry ?? (() => true);

  let lastError: unknown;
  let currentDelay = delayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      await sleep(currentDelay);
      currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export async function concurrent<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  if (limit < 1) {
    throw new Error("Concurrency limit must be at least 1");
  }
  const results: T[] = [];
  const executing: Promise<void>[] = [];
  let index = 0;

  for (const task of tasks) {
    const currentIndex = index++;
    const execute = async () => {
      results[currentIndex] = await task();
    };

    const p = execute().then(() => {
      const idx = executing.indexOf(p);
      if (idx !== -1) {
        executing.splice(idx, 1);
      }
    });

    executing.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

export async function* queue<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): AsyncGenerator<T> {
  if (concurrency < 1) {
    throw new Error("Concurrency must be at least 1");
  }

  const taskQueue: (() => Promise<T>)[] = [...tasks];
  const pending = new Map<Promise<T>, Promise<T>>();

  const launchTask = (): Promise<T> | null => {
    if (taskQueue.length === 0) return null;
    const task = taskQueue.shift()!;
    const p = task();
    pending.set(p, p);
    p.finally(() => {
      pending.delete(p);
    });
    return p;
  };

  for (let i = 0; i < concurrency && taskQueue.length > 0; i++) {
    launchTask();
  }

  while (pending.size > 0) {
    const completed = await Promise.race(pending.keys());
    yield completed;
    launchTask();
  }
}

export function semaphore(max: number): Semaphore {
  if (max < 1) {
    throw new Error("Semaphore max must be at least 1");
  }
  let current = 0;
  const waiters: (() => void)[] = [];

  const dispatch = () => {
    if (current < max && waiters.length > 0) {
      current++;
      const next = waiters.shift();
      if (next) next();
    }
  };

  return {
    acquire(): Promise<void> {
      if (current < max) {
        current++;
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        waiters.push(resolve);
      });
    },
    release(): void {
      if (current <= 0) {
        throw new Error("Cannot release semaphore: no acquired slots");
      }
      current--;
      dispatch();
    },
  };
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms: number
): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
  return debounced as T;
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  ms: number
): T {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const throttled = (...args: Parameters<T>) => {
    const now = Date.now();
    const elapsed = now - lastCall;
    if (elapsed >= ms) {
      lastCall = now;
      fn(...args);
    } else if (timer === null) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        timer = null;
        fn(...args);
      }, ms - elapsed);
    }
  };
  return throttled as T;
}

export function sleep(ms: number): Promise<void> {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new Error("Sleep duration must be a non-negative finite number");
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
