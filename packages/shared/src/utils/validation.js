export function validateConfig(config, requiredKeys) {
    if (typeof config !== 'object' || config === null) {
        return false;
    }
    return requiredKeys.every((key) => key in config);
}
export function validateAPIKey(key) {
    if (!isNonEmptyString(key)) {
        return false;
    }
    return key.length >= 8 && key.length <= 512;
}
export function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
export function isPositiveNumber(value) {
    return typeof value === 'number' && value > 0 && Number.isFinite(value);
}
export function isValidUrl(value) {
    try {
        new URL(value);
        return true;
    }
    catch {
        return false;
    }
}
export function isValidPort(value) {
    return Number.isInteger(value) && value >= 0 && value <= 65535;
}
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
//# sourceMappingURL=validation.js.map