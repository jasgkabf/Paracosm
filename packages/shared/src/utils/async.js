"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retry = retry;
exports.withTimeout = withTimeout;
exports.concurrent = concurrent;
exports.semaphore = semaphore;
exports.debounce = debounce;
exports.throttle = throttle;
exports.sleep = sleep;
exports.createDeferred = createDeferred;
async function retry(fn, options = {}) {
    const { maxRetries = 3, delay = 1000, backoffMultiplier = 2, shouldRetry = () => true, } = options;
    let lastError = new Error('Retry failed');
    let currentDelay = delay;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt >= maxRetries || !shouldRetry(lastError)) {
                throw lastError;
            }
            await sleep(currentDelay);
            currentDelay *= backoffMultiplier;
        }
    }
    throw lastError;
}
async function withTimeout(fn, timeoutMs, message = 'Operation timed out') {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    try {
        return await Promise.race([fn(), timeoutPromise]);
    }
    finally {
        clearTimeout(timer);
    }
}
async function concurrent(tasks, limit) {
    const results = [];
    const executing = new Set();
    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const p = task().then((result) => {
            results[i] = result;
        });
        executing.add(p);
        p.finally(() => executing.delete(p));
        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }
    await Promise.all(executing);
    return results;
}
function semaphore(limit) {
    let current = 0;
    const queue = [];
    function release() {
        current--;
        if (queue.length > 0) {
            const next = queue.shift();
            if (next) {
                current++;
                next();
            }
        }
    }
    return {
        acquire: () => new Promise((resolve) => {
            if (current < limit) {
                current++;
                resolve(release);
            }
            else {
                queue.push(() => {
                    current++;
                    resolve(release);
                });
            }
        }),
    };
}
function debounce(fn, delayMs) {
    let timer = null;
    return (...args) => {
        if (timer !== null) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            fn(...args);
            timer = null;
        }, delayMs);
    };
}
function throttle(fn, limitMs) {
    let lastCall = 0;
    let timer = null;
    return (...args) => {
        const now = Date.now();
        const elapsed = now - lastCall;
        if (elapsed >= limitMs) {
            lastCall = now;
            fn(...args);
        }
        else if (timer === null) {
            timer = setTimeout(() => {
                lastCall = Date.now();
                timer = null;
                fn(...args);
            }, limitMs - elapsed);
        }
    };
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function createDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}
//# sourceMappingURL=async.js.map