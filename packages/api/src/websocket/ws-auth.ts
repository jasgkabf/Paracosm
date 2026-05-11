import { createLogger } from '@paracosm/shared';

const logger = createLogger('WSAuth');

interface AuthToken {
  userId: string;
  expiresAt: number;
  scopes: string[];
}

interface AuthResult {
  valid: boolean;
  userId?: string;
  scopes?: string[];
  reason?: string;
}

export class WSAuth {
  private tokens: Map<string, AuthToken> = new Map();
  private apiKeys: Map<string, { userId: string; scopes: string[] }> = new Map();
  private requireAuth: boolean = false;
  private tokenExpiryMs: number = 86400000;

  constructor(config?: { requireAuth?: boolean; tokenExpiryMs?: number }) {
    this.requireAuth = config?.requireAuth ?? false;
    this.tokenExpiryMs = config?.tokenExpiryMs ?? 86400000;
  }

  validateToken(token: string): AuthResult {
    if (!this.requireAuth) {
      return { valid: true, userId: 'anonymous', scopes: ['*'] };
    }

    const authToken = this.tokens.get(token);
    if (authToken) {
      if (Date.now() > authToken.expiresAt) {
        this.tokens.delete(token);
        return { valid: false, reason: 'Token expired' };
      }
      return { valid: true, userId: authToken.userId, scopes: authToken.scopes };
    }

    const apiKeyEntry = this.apiKeys.get(token);
    if (apiKeyEntry) {
      return { valid: true, userId: apiKeyEntry.userId, scopes: apiKeyEntry.scopes };
    }

    return { valid: false, reason: 'Invalid token' };
  }

  generateToken(userId: string, scopes: string[] = ['*']): string {
    const token = `wst_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    this.tokens.set(token, {
      userId,
      expiresAt: Date.now() + this.tokenExpiryMs,
      scopes,
    });
    logger.info('Token generated', { userId });
    return token;
  }

  revokeToken(token: string): boolean {
    return this.tokens.delete(token);
  }

  registerApiKey(key: string, userId: string, scopes: string[] = ['*']): void {
    this.apiKeys.set(key, { userId, scopes });
    logger.info('API key registered', { userId });
  }

  revokeApiKey(key: string): boolean {
    return this.apiKeys.delete(key);
  }

  hasScope(token: string, scope: string): boolean {
    const result = this.validateToken(token);
    if (!result.valid || !result.scopes) return false;
    return result.scopes.includes('*') || result.scopes.includes(scope);
  }

  setRequireAuth(require: boolean): void {
    this.requireAuth = require;
  }

  cleanup(): number {
    let removed = 0;
    const now = Date.now();
    for (const [token, authToken] of this.tokens) {
      if (now > authToken.expiresAt) {
        this.tokens.delete(token);
        removed++;
      }
    }
    return removed;
  }
}
