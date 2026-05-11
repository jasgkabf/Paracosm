export function base64Encode(data) {
    return Buffer.from(data, 'utf8').toString('base64');
}
export function base64Decode(encoded) {
    return Buffer.from(encoded, 'base64').toString('utf8');
}
export function urlEncode(data) {
    return encodeURIComponent(data);
}
export function urlDecode(encoded) {
    return decodeURIComponent(encoded);
}
export function hexEncode(data) {
    return Buffer.from(data, 'utf8').toString('hex');
}
export function hexDecode(hex) {
    return Buffer.from(hex, 'hex').toString('utf8');
}
//# sourceMappingURL=encoding.js.map