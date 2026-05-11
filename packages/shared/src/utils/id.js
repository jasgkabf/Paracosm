"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.generateUUID = generateUUID;
exports.generateShortId = generateShortId;
exports.generateEntityId = generateEntityId;
const uuid_1 = require("uuid");
function generateId() {
    return (0, uuid_1.v4)();
}
function generateUUID() {
    return (0, uuid_1.v4)();
}
function generateShortId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
function generateEntityId(prefix) {
    return `${prefix}_${generateShortId(12)}`;
}
//# sourceMappingURL=id.js.map