export declare function encrypt(plaintext: string, key: Buffer): string;
export declare function decrypt(ciphertext: string, key: Buffer): string;
export declare function hash(data: string): string;
export declare function generateKey(): Buffer;
export declare function keyDerivation(password: string, salt: Buffer): Buffer;
export declare function generateSalt(): Buffer;
//# sourceMappingURL=crypto.d.ts.map