import { createLogger } from '@paracosm/shared';
import type { ProviderConfig } from '@paracosm/shared';

const logger = createLogger('ConfigEncryption');

export class ConfigEncryption {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;

  async encrypt(plaintext: string, key: string): Promise<string> {
    const crypto = await import('crypto');
    const derivedKey = crypto.scryptSync(key, 'paracosm-salt', this.keyLength);
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, derivedKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    const combined = Buffer.concat([
      iv,
      tag,
      Buffer.from(encrypted, 'hex'),
    ]);

    return combined.toString('base64');
  }

  async decrypt(ciphertext: string, key: string): Promise<string> {
    const crypto = await import('crypto');
    const derivedKey = crypto.scryptSync(key, 'paracosm-salt', this.keyLength);
    const combined = Buffer.from(ciphertext, 'base64');

    const iv = combined.subarray(0, this.ivLength);
    const tag = combined.subarray(this.ivLength, this.ivLength + this.tagLength);
    const encrypted = combined.subarray(this.ivLength + this.tagLength);

    const decipher = crypto.createDecipheriv(this.algorithm, derivedKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  encryptConfig(config: Record<string, unknown>, key: string): Record<string, unknown> {
    const result = { ...config };
    const providers = result.providers as ProviderConfig[] | undefined;

    if (providers) {
      result.providers = providers.map((p) => {
        if (!p.apiKey) return p;
        try {
          const encrypted = this.encryptSync(p.apiKey, key);
          return { ...p, apiKey: `enc:${encrypted}`, metadata: { ...p.metadata, encrypted: true } };
        } catch (error) {
          logger.error('Failed to encrypt API key', { provider: p.provider });
          return p;
        }
      });
    }

    return result;
  }

  decryptConfig(config: Record<string, unknown>, key: string): Record<string, unknown> {
    const result = { ...config };
    const providers = result.providers as ProviderConfig[] | undefined;

    if (providers) {
      result.providers = providers.map((p) => {
        if (!p.apiKey || !p.apiKey.startsWith('enc:')) return p;
        try {
          const encrypted = p.apiKey.substring(4);
          const decrypted = this.decryptSync(encrypted, key);
          return { ...p, apiKey: decrypted, metadata: { ...p.metadata, encrypted: false } };
        } catch (error) {
          logger.error('Failed to decrypt API key', { provider: p.provider });
          return p;
        }
      });
    }

    return result;
  }

  private encryptSync(plaintext: string, key: string): string {
    const crypto = require('crypto');
    const derivedKey = crypto.scryptSync(key, 'paracosm-salt', this.keyLength);
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, derivedKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    const combined = Buffer.concat([
      iv,
      tag,
      Buffer.from(encrypted, 'hex'),
    ]);

    return combined.toString('base64');
  }

  private decryptSync(ciphertext: string, key: string): string {
    const crypto = require('crypto');
    const derivedKey = crypto.scryptSync(key, 'paracosm-salt', this.keyLength);
    const combined = Buffer.from(ciphertext, 'base64');

    const iv = combined.subarray(0, this.ivLength);
    const tag = combined.subarray(this.ivLength, this.ivLength + this.tagLength);
    const encrypted = combined.subarray(this.ivLength + this.tagLength);

    const decipher = crypto.createDecipheriv(this.algorithm, derivedKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  isEncrypted(value: string): boolean {
    return value.startsWith('enc:');
  }

  async generateKey(): Promise<string> {
    const crypto = await import('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  async hashKey(key: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(key).digest('hex');
  }
}
