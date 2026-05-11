"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.base64Encode = base64Encode;
exports.base64Decode = base64Decode;
exports.urlEncode = urlEncode;
exports.urlDecode = urlDecode;
exports.hexEncode = hexEncode;
exports.hexDecode = hexDecode;
function base64Encode(data) {
    return Buffer.from(data, 'utf8').toString('base64');
}
function base64Decode(encoded) {
    return Buffer.from(encoded, 'base64').toString('utf8');
}
function urlEncode(data) {
    return encodeURIComponent(data);
}
function urlDecode(encoded) {
    return decodeURIComponent(encoded);
}
function hexEncode(data) {
    return Buffer.from(data, 'utf8').toString('hex');
}
function hexDecode(hex) {
    return Buffer.from(hex, 'hex').toString('utf8');
}
//# sourceMappingURL=encoding.js.map