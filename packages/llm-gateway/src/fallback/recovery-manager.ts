import { createLogger } from '@paracosm/shared';
import type { LLMProvider } from '@paracosm/shared';

const logger = createLogger('RecoveryManager');

export interface RecoveryConfig {
  maxRecoveryAttempts: number;
  recoveryIntervalMs: number;
  testRequestTimeoutMs: number;
  cooldownMs: number;
  autoSwitchEnabled: boolean;
}

export interface RecoveryAttempt {
  provider: string;
  attempt: number;
  success: boolean;
  latencyMs: number;
  timestamp: number;
  error?: string;
}

export interface RecoveryStatus {
  provider: string;
  isRecovering: boolean;
  attemptCount: number;
  lastAttemptTime: number;
  nextAttemptTime: number;
  lastSuccessTime: number;
  recoveredAt: number;
}

export class RecoveryManager {
  private config: RecoveryConfig;
  private attempts: Map<string, RecoveryAttempt[]> = new Map();
  private maxAttemptsPerProvider: number = 50;
  private statuses: Map<string, RecoveryStatus> = new Map();
  private recoveryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private providerTestFns: Map<string, () => Promise<{ success: boolean; latencyMs: number }>> = new Map();
  private switchCallbacks: Array<(from: string, to: string) => void> = [];
  private recoveryCallbacks: Array<(provider: string, success: boolean) => void> = [];

  constructor(config?: Partial<RecoveryConfig>) {
    this.config = {
      maxRecoveryAttempts: config?.maxRecoveryAttempts ?? 5,
      recoveryIntervalMs: config?.recoveryIntervalMs ?? 30000,
      testRequestTimeoutMs: config?.testRequestTimeoutMs ?? 10000,
      cooldownMs: config?.cooldownMs ?? 60000,
      autoSwitchEnabled: config?.autoSwitchEnabled ?? true,
    };
  }

  registerTestFn(provider: string, testFn: () => Promise<{ success: boolean; latencyMs: number }>): void {
    this.providerTestFns.set(provider, testFn);
    logger.info('Recovery test function registered', { provider });
  }

  async recover(provider: string): Promise<boolean> {
    const status = this.getOrCreateStatus(provider);
    if (status.isRecovering) {
      logger.info('Recovery already in progress', { provider });
      return false;
    }

    status.isRecovering = true;
    status.attemptCount = 0;

    const result = await this.attemptRecovery(provider);

    status.isRecovering = false;
    return result;
  }

  async testRecovery(provider: string): Promise<RecoveryAttempt> {
    const testFn = this.providerTestFns.get(provider);
    const attempt: RecoveryAttempt = {
      provider,
      attempt: (this.attempts.get(provider)?.length ?? 0) + 1,
      success: false,
      latencyMs: 0,
      timestamp: Date.now(),
    };

    if (!testFn) {
      attempt.error = 'No test function registered';
      this.recordAttempt(provider, attempt);
      return attempt;
    }

    try {
      const timeoutPromise = new Promise<{ success: false; latencyMs: number }>(
        (resolve) => setTimeout(
          () => resolve({ success: false, latencyMs: this.config.testRequestTimeoutMs }),
          this.config.testRequestTimeoutMs,
        ),
      );

      const result = await Promise.race([testFn(), timeoutPromise]);
      attempt.success = result.success;
      attempt.latencyMs = result.latencyMs;

      if (attempt.success) {
        logger.info('Recovery test succeeded', {
          provider,
          latencyMs: attempt.latencyMs,
        });
      } else {
        attempt.error = 'Test returned unsuccessful';
        logger.warn('Recovery test failed', { provider });
      }
    } catch (error) {
      attempt.error = (error as Error).message;
      attempt.latencyMs = this.config.testRequestTimeoutMs;
      logger.warn('Recovery test error', { provider, error: attempt.error });
    }

    this.recordAttempt(provider, attempt);
    return attempt;
  }

  async autoSwitch(fromProvider: string, toProvider: string): Promise<boolean> {
    if (!this.config.autoSwitchEnabled) {
      logger.info('Auto-switch disabled, skipping', { fromProvider, toProvider });
      return false;
    }

    const toTestFn = this.providerTestFns.get(toProvider);
    if (!toTestFn) {
      logger.warn('No test function for target provider', { toProvider });
      return false;
    }

    try {
      const result = await toTestFn();
      if (result.success) {
        for (const callback of this.switchCallbacks) {
          try {
            callback(fromProvider, toProvider);
          } catch (error) {
            logger.error('Switch callback error', { error: (error as Error).message });
          }
        }

        logger.info('Auto-switch completed', { fromProvider, toProvider });
        return true;
      }
    } catch (error) {
      logger.error('Auto-switch test failed', {
        toProvider,
        error: (error as Error).message,
      });
    }

    return false;
  }

  scheduleRecovery(provider: string): void {
    if (this.recoveryTimers.has(provider)) return;

    const timer = setInterval(async () => {
      const status = this.statuses.get(provider);
      if (!status || !status.isRecovering) {
        this.cancelRecovery(provider);
        return;
      }

      if (status.attemptCount >= this.config.maxRecoveryAttempts) {
        logger.warn('Max recovery attempts reached', {
          provider,
          attempts: status.attemptCount,
        });
        this.cancelRecovery(provider);
        return;
      }

      const attempt = await this.testRecovery(provider);
      status.attemptCount++;
      status.lastAttemptTime = Date.now();
      status.nextAttemptTime = Date.now() + this.config.recoveryIntervalMs;

      if (attempt.success) {
        status.recoveredAt = Date.now();
        status.lastSuccessTime = Date.now();
        status.isRecovering = false;

        for (const callback of this.recoveryCallbacks) {
          try {
            callback(provider, true);
          } catch (error) {
            logger.error('Recovery callback error', { error: (error as Error).message });
          }
        }

        logger.info('Provider recovered', { provider, attempts: status.attemptCount });
        this.cancelRecovery(provider);
      }
    }, this.config.recoveryIntervalMs);

    this.recoveryTimers.set(provider, timer);
    logger.info('Recovery scheduled', {
      provider,
      intervalMs: this.config.recoveryIntervalMs,
    });
  }

  cancelRecovery(provider: string): void {
    const timer = this.recoveryTimers.get(provider);
    if (timer) {
      clearInterval(timer);
      this.recoveryTimers.delete(provider);
    }

    const status = this.statuses.get(provider);
    if (status) {
      status.isRecovering = false;
    }

    logger.info('Recovery cancelled', { provider });
  }

  getStatus(provider: string): RecoveryStatus | undefined {
    return this.statuses.get(provider);
  }

  getAllStatuses(): Record<string, RecoveryStatus> {
    const result: Record<string, RecoveryStatus> = {};
    for (const [key, value] of this.statuses) {
      result[key] = { ...value };
    }
    return result;
  }

  getAttempts(provider: string, limit?: number): RecoveryAttempt[] {
    const attempts = this.attempts.get(provider) ?? [];
    return limit ? attempts.slice(-limit) : [...attempts];
  }

  onSwitch(callback: (from: string, to: string) => void): void {
    this.switchCallbacks.push(callback);
  }

  onRecovery(callback: (provider: string, success: boolean) => void): void {
    this.recoveryCallbacks.push(callback);
  }

  getConfig(): RecoveryConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<RecoveryConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  reset(provider: string): void {
    this.cancelRecovery(provider);
    this.attempts.delete(provider);
    this.statuses.delete(provider);
  }

  destroy(): void {
    for (const timer of this.recoveryTimers.values()) {
      clearInterval(timer);
    }
    this.recoveryTimers.clear();
    this.attempts.clear();
    this.statuses.clear();
    this.providerTestFns.clear();
    this.switchCallbacks = [];
    this.recoveryCallbacks = [];
  }

  private getOrCreateStatus(provider: string): RecoveryStatus {
    if (!this.statuses.has(provider)) {
      this.statuses.set(provider, {
        provider,
        isRecovering: false,
        attemptCount: 0,
        lastAttemptTime: 0,
        nextAttemptTime: 0,
        lastSuccessTime: 0,
        recoveredAt: 0,
      });
    }
    return this.statuses.get(provider)!;
  }

  private recordAttempt(provider: string, attempt: RecoveryAttempt): void {
    if (!this.attempts.has(provider)) {
      this.attempts.set(provider, []);
    }
    const providerAttempts = this.attempts.get(provider)!;
    providerAttempts.push(attempt);
    if (providerAttempts.length > this.maxAttemptsPerProvider) {
      providerAttempts.splice(0, providerAttempts.length - this.maxAttemptsPerProvider);
    }
  }

  private async attemptRecovery(provider: string): Promise<boolean> {
    const status = this.getOrCreateStatus(provider);

    for (let i = 0; i < this.config.maxRecoveryAttempts; i++) {
      const attempt = await this.testRecovery(provider);
      status.attemptCount++;
      status.lastAttemptTime = Date.now();

      if (attempt.success) {
        status.recoveredAt = Date.now();
        status.lastSuccessTime = Date.now();
        status.isRecovering = false;

        for (const callback of this.recoveryCallbacks) {
          try {
            callback(provider, true);
          } catch (error) {
            logger.error('Recovery callback error', { error: (error as Error).message });
          }
        }

        return true;
      }

      if (i < this.config.maxRecoveryAttempts - 1) {
        await this.sleep(this.config.recoveryIntervalMs);
      }
    }

    status.isRecovering = false;
    status.nextAttemptTime = Date.now() + this.config.cooldownMs;

    for (const callback of this.recoveryCallbacks) {
      try {
        callback(provider, false);
      } catch (error) {
        logger.error('Recovery callback error', { error: (error as Error).message });
      }
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
