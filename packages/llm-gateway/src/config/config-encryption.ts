import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from "node:crypto";
import { Result, ok, err } from "@paracosm/shared";
import { ConfigError } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";

const logger = new Logger("ConfigEncryption");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

export class ConfigEncryption {
  private masterKey: string;
  private salt: string;

  constructor(masterKey: string, salt?: string) {
    this.masterKey = masterKey;
    this.salt = salt ?? randomBytes(SALT_LENGTH).toString("hex");
  }

  private deriveKey(): Buffer {
    const saltBuffer = Buffer.from(this.salt, "hex");
    const derived = pbkdf2Sync(this.masterKey, saltBuffer, PBKDF2_ITERATIONS, KEY_LENGTH, "sha512");
    return derived;
  }

  encrypt(plaintext: string): Result<string, ConfigError> {
    try {
      const key = this.deriveKey();
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();
      const result = Buffer.concat([iv, tag, encrypted]);
      return ok(result.toString("base64"));
    } catch (error) {
      return err(new ConfigError(
        `Encryption failed: ${error instanceof Error ? error.message : String(error)}`,
        { error: String(error) },
        error instanceof Error ? error : undefined
      ));
    }
  }

  decrypt(ciphertext: string): Result<string, ConfigError> {
    try {
      const key = this.deriveKey();
      const data = Buffer.from(ciphertext, "base64");
      if (data.length < IV_LENGTH + TAG_LENGTH) {
        return err(new ConfigError("Ciphertext too short", { length: data.length }));
      }
      const iv = data.subarray(0, IV_LENGTH);
      const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
      const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);
      return ok(decrypted.toString("utf8"));
    } catch (error) {
      return err(new ConfigError(
        `Decryption failed: ${error instanceof Error ? error.message : String(error)}`,
        { error: String(error) },
        error instanceof Error ? error : undefined
      ));
    }
  }

  keyDerivation(password: string, salt: string): Result<string, ConfigError> {
    try {
      const saltBuffer = Buffer.from(salt, "hex");
      if (saltBuffer.length !== SALT_LENGTH) {
        return err(new ConfigError(`Salt must be ${SALT_LENGTH} bytes`, { saltLength: saltBuffer.length }));
      }
      const derived = pbkdf2Sync(password, saltBuffer, PBKDF2_ITERATIONS, KEY_LENGTH, "sha512");
      return ok(derived.toString("hex"));
    } catch (error) {
      return err(new ConfigError(
        `Key derivation failed: ${error instanceof Error ? error.message : String(error)}`,
        { error: String(error) }
      ));
    }
  }

  secureStore(key: string, value: string): Result<void, ConfigError> {
    try {
      const encrypted = this.encrypt(value);
      if (!encrypted.ok) {
        return err(encrypted.error);
      }
      const store = this.loadSecureStore();
      store[key] = { encrypted: encrypted.value, salt: this.salt, updatedAt: new Date().toISOString() };
      this.saveSecureStore(store);
      logger.info(`Securely stored value for key: ${key}`);
      return ok(undefined);
    } catch (error) {
      return err(new ConfigError(
        `Secure store failed: ${error instanceof Error ? error.message : String(error)}`,
        { key, error: String(error) }
      ));
    }
  }

  secureRetrieve(key: string): Result<string, ConfigError> {
    try {
      const store = this.loadSecureStore();
      const entry = store[key];
      if (!entry) {
        return err(new ConfigError(`Key not found in secure store: ${key}`, { key }));
      }
      const decryptor = new ConfigEncryption(this.masterKey, entry.salt);
      const decrypted = decryptor.decrypt(entry.encrypted);
      if (!decrypted.ok) {
        return err(decrypted.error);
      }
      return ok(decrypted.value);
    } catch (error) {
      return err(new ConfigError(
        `Secure retrieve failed: ${error instanceof Error ? error.message : String(error)}`,
        { key, error: String(error) }
      ));
    }
  }

  secureDelete(key: string): Result<void, ConfigError> {
    try {
      const store = this.loadSecureStore();
      if (!(key in store)) {
        return err(new ConfigError(`Key not found in secure store: ${key}`, { key }));
      }
      delete store[key];
      this.saveSecureStore(store);
      logger.info(`Deleted secure value for key: ${key}`);
      return ok(undefined);
    } catch (error) {
      return err(new ConfigError(
        `Secure delete failed: ${error instanceof Error ? error.message : String(error)}`,
        { key, error: String(error) }
      ));
    }
  }

  getSalt(): string {
    return this.salt;
  }

  private loadSecureStore(): Record<string, { encrypted: string; salt: string; updatedAt: string }> {
    try {
      if (typeof process !== "undefined" && process.env) {
        const storeEnv = process.env.__PARACOSM_SECURE_STORE__;
        if (storeEnv) {
          return JSON.parse(storeEnv);
        }
      }
    } catch {
      // return empty store
    }
    return {};
  }

  private saveSecureStore(store: Record<string, { encrypted: string; salt: string; updatedAt: string }>): void {
    if (typeof process !== "undefined" && process.env) {
      process.env.__PARACOSM_SECURE_STORE__ = JSON.stringify(store);
    }
  }
}
