import { Result, ok, err } from "@paracosm/shared";
import { ConfigError } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";
import { CONFIG_VERSION } from "./config-defaults.js";

const logger = new Logger("ConfigMigrator");

interface MigrationStep {
  fromVersion: number;
  toVersion: number;
  migrate(data: Record<string, unknown>): Record<string, unknown>;
}

const MIGRATIONS: MigrationStep[] = [
  {
    fromVersion: 0,
    toVersion: 1,
    migrate(data: Record<string, unknown>): Record<string, unknown> {
      const result = { ...data };
      if (!result.version) {
        result.version = 1;
      }
      if (result.providers && Array.isArray(result.providers)) {
        result.providers = (result.providers as Record<string, unknown>[]).map((p) => ({
          enabled: true,
          priority: 1,
          retries: 3,
          retryDelayMs: 1000,
          timeoutMs: 30000,
          rateLimitRpm: 500,
          rateLimitTpm: 200000,
          organizationId: null,
          defaultModelId: null,
          ...p,
        }));
      }
      if (result.routing && typeof result.routing === "object") {
        const routing = result.routing as Record<string, unknown>;
        if (!routing.strategy) {
          routing.strategy = "balanced";
        }
        if (!routing.enableCaching) {
          routing.enableCaching = true;
        }
        if (!routing.cacheTtlMs) {
          routing.cacheTtlMs = 300000;
        }
        if (!routing.maxCacheSize) {
          routing.maxCacheSize = 1000;
        }
      }
      if (result.budgets && typeof result.budgets === "object") {
        const budgets = result.budgets as Record<string, unknown>;
        if (!budgets.perRequestLimitUsd) {
          budgets.perRequestLimitUsd = 5;
        }
        if (!budgets.alertThresholdPercent) {
          budgets.alertThresholdPercent = 80;
        }
        if (budgets.enableThrottling === undefined) {
          budgets.enableThrottling = true;
        }
        if (!budgets.throttleAtPercent) {
          budgets.throttleAtPercent = 90;
        }
      }
      if (result.fallback && typeof result.fallback === "object") {
        const fallback = result.fallback as Record<string, unknown>;
        if (!fallback.defaultChainId) {
          fallback.defaultChainId = "default";
        }
        if (fallback.enableAutomaticFallback === undefined) {
          fallback.enableAutomaticFallback = true;
        }
        if (fallback.fallbackOnError === undefined) {
          fallback.fallbackOnError = true;
        }
        if (fallback.fallbackOnTimeout === undefined) {
          fallback.fallbackOnTimeout = true;
        }
        if (fallback.fallbackOnRateLimit === undefined) {
          fallback.fallbackOnRateLimit = true;
        }
        if (fallback.fallbackOnContentFilter === undefined) {
          fallback.fallbackOnContentFilter = false;
        }
      }
      return result;
    },
  },
];

export class ConfigMigrator {
  private currentVersion: number;

  constructor() {
    this.currentVersion = CONFIG_VERSION;
  }

  detectVersion(data: Record<string, unknown>): number {
    if (typeof data.version === "number") {
      return data.version;
    }
    if (data.providers && typeof data.providers === "object") {
      return 1;
    }
    return 0;
  }

  needsMigration(data: Record<string, unknown>): boolean {
    const version = this.detectVersion(data);
    return version < this.currentVersion;
  }

  migrate(data: Record<string, unknown>): Result<Record<string, unknown>, ConfigError> {
    try {
      let current = { ...data };
      let version = this.detectVersion(current);

      if (version > this.currentVersion) {
        return err(new ConfigError(
          `Config version ${version} is newer than supported version ${this.currentVersion}`,
          { configVersion: version, supportedVersion: this.currentVersion }
        ));
      }

      let iterations = 0;
      const maxIterations = MIGRATIONS.length + 1;

      while (version < this.currentVersion && iterations < maxIterations) {
        const migration = MIGRATIONS.find((m) => m.fromVersion === version);
        if (!migration) {
          return err(new ConfigError(
            `No migration path from version ${version} to ${version + 1}`,
            { fromVersion: version }
          ));
        }
        logger.info(`Migrating config from version ${version} to ${migration.toVersion}`);
        current = migration.migrate(current);
        version = migration.toVersion;
        current.version = version;
        iterations++;
      }

      if (version !== this.currentVersion) {
        return err(new ConfigError(
          `Migration incomplete: ended at version ${version}, expected ${this.currentVersion}`,
          { finalVersion: version, expectedVersion: this.currentVersion }
        ));
      }

      logger.info(`Config migrated to version ${version}`);
      return ok(current);
    } catch (error) {
      return err(new ConfigError(
        `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
        { error: String(error) },
        error instanceof Error ? error : undefined
      ));
    }
  }

  autoUpgrade(data: Record<string, unknown>): Result<Record<string, unknown>, ConfigError> {
    if (!this.needsMigration(data)) {
      return ok(data);
    }
    return this.migrate(data);
  }

  getCurrentVersion(): number {
    return this.currentVersion;
  }

  getMigrationPath(fromVersion: number): number[] {
    const path: number[] = [fromVersion];
    let current = fromVersion;
    while (current < this.currentVersion) {
      const migration = MIGRATIONS.find((m) => m.fromVersion === current);
      if (!migration) {
        break;
      }
      current = migration.toVersion;
      path.push(current);
    }
    return path;
  }
}
