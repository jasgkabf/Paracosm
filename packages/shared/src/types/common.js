"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ok = ok;
exports.err = err;
exports.isOk = isOk;
exports.isErr = isErr;
exports.some = some;
exports.none = none;
exports.isSome = isSome;
exports.isNone = isNone;
function ok(value) {
    return { ok: true, value };
}
function err(error) {
    return { ok: false, err: error };
}
function isOk(result) {
    return result.ok === true;
}
function isErr(result) {
    return result.ok === false;
}
function some(value) {
    return { some: true, value };
}
function none() {
    return { some: false };
}
function isSome(option) {
    return option.some === true;
}
function isNone(option) {
    return option.some === false;
}
//# sourceMappingURL=common.js.map