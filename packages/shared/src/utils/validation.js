"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfig = validateConfig;
exports.validateAPIKey = validateAPIKey;
exports.isNonEmptyString = isNonEmptyString;
exports.isPositiveNumber = isPositiveNumber;
exports.isValidUrl = isValidUrl;
exports.isValidPort = isValidPort;
exports.clamp = clamp;
function validateConfig(config, requiredKeys) {
    if (typeof config !== 'object' || config === null) {
        return false;
    }
    return requiredKeys.every((key) => key in config);
}
function validateAPIKey(key) {
    if (!isNonEmptyString(key)) {
        return false;
    }
    return key.length >= 8 && key.length <= 512;
}
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
function isPositiveNumber(value) {
    return typeof value === 'number' && value > 0 && Number.isFinite(value);
}
function isValidUrl(value) {
    try {
        new URL(value);
        return true;
    }
    catch {
        return false;
    }
}
function isValidPort(value) {
    return Number.isInteger(value) && value >= 0 && value <= 65535;
}
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
//# sourceMappingURL=validation.js.map