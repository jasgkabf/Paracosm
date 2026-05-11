import { createLogger } from '@paracosm/shared';

const logger = createLogger('ConfigMigrator');

export interface MigrationStep {
  fromVersion: number;
  toVersion: number;
  migrate: (config: Record<string, unknown>) => Record<string, unknown>;
}

export class ConfigMigrator {
  private migrations: MigrationStep[] = [
    {
      fromVersion: 0,
      toVersion: 1,
      migrate: (config) => {
        const migrated = { ...config };
        if (!migrated.providers) {
          migrated.providers = [];
        }
        if (!migrated.routing) {
          migrated.routing = { strategy: 'adaptive', rules: [] };
        }
        if (!migrated.budget) {
          migrated.budget = {
            dailyLimit: 10,
            monthlyLimit: 100,
            perRequestLimit: 1,
            alertThreshold: 0.8,
            currency: 'USD',
          };
        }
        if (!migrated.fallback) {
          migrated.fallback = {
            enabled: true,
            maxRetries: 3,
            retryDelay: 1000,
            backoffMultiplier: 2,
            fallbackProviders: [],
            fallbackModels: [],
          };
        }
        migrated.version = 1;
        return migrated;
      },
    },
    {
      fromVersion: 1,
      toVersion: 2,
      migrate: (config) => {
        const migrated = { ...config };
        const providers = migrated.providers as Array<Record<string, unknown>> || [];
        for (const provider of providers) {
          if (provider.maxConcurrentRequests === undefined) {
            provider.maxConcurrentRequests = 10;
          }
          if (provider.timeout === undefined) {
            provider.timeout = 30000;
          }
          if (provider.retries === undefined) {
            provider.retries = 3;
          }
          if (!provider.metadata) {
            provider.metadata = {};
          }
        }
        if (!migrated.retries) {
          migrated.retries = 3;
        }
        if (!migrated.timeout) {
          migrated.timeout = 30000;
        }
        migrated.version = 2;
        return migrated;
      },
    },
    {
      fromVersion: 2,
      toVersion: 3,
      migrate: (config) => {
        const migrated = { ...config };
        if (!migrated.encryption) {
          migrated.encryption = { enabled: false, algorithm: 'aes-256-gcm' };
        }
        if (!migrated.metadata) {
          migrated.metadata = {};
        }
        const routing = migrated.routing as Record<string, unknown> | undefined;
        if (routing && !routing.rules) {
          routing.rules = [];
        }
        migrated.version = 3;
        return migrated;
      },
    },
  ];

  private currentVersion = 3;

  migrate(config: unknown): Record<string, unknown> {
    if (typeof config !== 'object' || config === null) {
      logger.warn('Invalid config object, returning defaults');
      return { version: this.currentVersion };
    }

    let migrated = config as Record<string, unknown>;
    const version = typeof migrated.version === 'number' ? migrated.version : 0;

    if (version >= this.currentVersion) {
      return migrated;
    }

    logger.info('Migrating config', { from: version, to: this.currentVersion });

    let currentVersion = version;
    while (currentVersion < this.currentVersion) {
      const step = this.migrations.find((m) => m.fromVersion === currentVersion);
      if (!step) {
        logger.error('No migration found', { version: currentVersion });
        break;
      }
      try {
        migrated = step.migrate(migrated);
        currentVersion = step.toVersion;
        logger.info('Migration step applied', { from: step.fromVersion, to: step.toVersion });
      } catch (error) {
        logger.error('Migration failed', {
          from: step.fromVersion,
          to: step.toVersion,
          error: (error as Error).message,
        });
        break;
      }
    }

    return migrated;
  }

  getCurrentVersion(): number {
    return this.currentVersion;
  }

  needsMigration(config: unknown): boolean {
    if (typeof config !== 'object' || config === null) return true;
    const version = (config as Record<string, unknown>).version;
    return typeof version !== 'number' || version < this.currentVersion;
  }

  addMigration(step: MigrationStep): void {
    this.migrations.push(step);
    this.migrations.sort((a, b) => a.fromVersion - b.fromVersion);
    if (step.toVersion > this.currentVersion) {
      this.currentVersion = step.toVersion;
    }
  }
}
