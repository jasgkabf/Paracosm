"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.hash = hash;
exports.generateKey = generateKey;
exports.keyDerivation = keyDerivation;
exports.generateSalt = generateSalt;
const crypto_1 = require("crypto");
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT_LENGTH = 32;
const ITERATIONS = 100000;
function encrypt(plaintext, key) {
    const iv = (0, crypto_1.randomBytes)(IV_LENGTH);
    const cipher = (0, crypto_1.createCipheriv)(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
}
function decrypt(ciphertext, key) {
    const data = Buffer.from(ciphertext, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = (0, crypto_1.createDecipheriv)(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
    ]);
    return decrypted.toString('utf8');
}
function hash(data) {
    return (0, crypto_1.createHash)('sha256').update(data).digest('hex');
}
function generateKey() {
    return (0, crypto_1.randomBytes)(KEY_LENGTH);
}
function keyDerivation(password, salt) {
    return (0, crypto_1.pbkdf2Sync)(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}
function generateSalt() {
    return (0, crypto_1.randomBytes)(SALT_LENGTH);
}
//# sourceMappingURL=crypto.js.map