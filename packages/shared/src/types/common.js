export function ok(value) {
    return { ok: true, value };
}
export function err(error) {
    return { ok: false, err: error };
}
export function isOk(result) {
    return result.ok === true;
}
export function isErr(result) {
    return result.ok === false;
}
export function some(value) {
    return { some: true, value };
}
export function none() {
    return { some: false };
}
export function isSome(option) {
    return option.some === true;
}
export function isNone(option) {
    return option.some === false;
}
//# sourceMappingURL=common.js.map