export function safeParse(json, fallback) {
    try {
        return JSON.parse(json);
    }
    catch {
        return fallback;
    }
}
export function safeStringify(value, replacer, space) {
    try {
        return JSON.stringify(value, replacer, space);
    }
    catch {
        return '{}';
    }
}
export function deepClone(value) {
    if (value === null || typeof value !== 'object') {
        return value;
    }
    return JSON.parse(JSON.stringify(value));
}
export function merge(target, ...sources) {
    const result = { ...target };
    for (const source of sources) {
        for (const key of Object.keys(source)) {
            if (source[key] !== undefined) {
                result[key] = source[key];
            }
        }
    }
    return result;
}
export function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (typeof source[key] === 'object' &&
            source[key] !== null &&
            !Array.isArray(source[key]) &&
            typeof result[key] === 'object' &&
            result[key] !== null &&
            !Array.isArray(result[key])) {
            result[key] = deepMerge(result[key], source[key]);
        }
        else if (source[key] !== undefined) {
            result[key] = source[key];
        }
    }
    return result;
}
export function pick(obj, keys) {
    const result = {};
    for (const key of keys) {
        if (key in obj) {
            result[key] = obj[key];
        }
    }
    return result;
}
export function omit(obj, keys) {
    const result = { ...obj };
    for (const key of keys) {
        delete result[key];
    }
    return result;
}
//# sourceMappingURL=json.js.map