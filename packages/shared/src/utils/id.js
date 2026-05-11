import { v4 as uuidv4 } from 'uuid';
export function generateId() {
    return uuidv4();
}
export function generateUUID() {
    return uuidv4();
}
export function generateShortId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
export function generateEntityId(prefix) {
    return `${prefix}_${generateShortId(12)}`;
}
//# sourceMappingURL=id.js.map