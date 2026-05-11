import { createCipheriv, createDecipheriv, createHash, randomBytes, pbkdf2Sync } from "node:crypto";
import { createReadStream } from "node:fs";
import { Result, ok, err } from "../types/common.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

export function encrypt(data: string, key: string): string {
  const keyBuffer = Buffer.from(key, "hex");
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`Key must be ${KEY_LENGTH} bytes, got ${keyBuffer.length}`);
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);
  const encrypted = Buffer.concat([
    cipher.update(data, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const result = Buffer.concat([iv, tag, encrypted]);
  return result.toString("base64");
}

export function decrypt(encrypted: string, key: string): string {
  const keyBuffer = Buffer.from(key, "hex");
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`Key must be ${KEY_LENGTH} bytes, got ${keyBuffer.length}`);
  }
  const data = Buffer.from(encrypted, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function hash(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

export async function hashFile(filePath: string): Promise<Result<string, string>> {
  return new Promise((resolve) => {
    const hashObj = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk: string | Buffer) => {
      hashObj.update(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    stream.on("end", () => {
      resolve(ok(hashObj.digest("hex")));
    });
    stream.on("error", (error: Error) => {
      resolve(err(`Failed to hash file: ${error.message}`));
    });
  });
}

export function generateKey(): string {
  return randomBytes(KEY_LENGTH).toString("hex");
}

export function keyDerivation(password: string, salt: string): string {
  const saltBuffer = Buffer.from(salt, "hex");
  if (saltBuffer.length !== SALT_LENGTH) {
    throw new Error(`Salt must be ${SALT_LENGTH} bytes, got ${saltBuffer.length}`);
  }
  const derived = pbkdf2Sync(password, saltBuffer, PBKDF2_ITERATIONS, KEY_LENGTH, "sha512");
  return derived.toString("hex");
}

export function generateSalt(): string {
  return randomBytes(SALT_LENGTH).toString("hex");
}
