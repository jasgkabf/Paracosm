import type { LLMConfig, LLMProvider, ProviderConfig, RoutingRule, BudgetConfig, FallbackConfig } from '@paracosm/shared';
import { ConfigDefaults } from './config-defaults.js';
import { ConfigEncryption } from './config-encryption.js';
import { ConfigMigrator } from './config-migrator.js';
import { ConfigWatcher } from './config-watcher.js';
import { validateProvidersConfig } from './providers-schema.js';
import { validateModelsConfig } from './models-schema.js';
import { validateRoutingConfig } from './routing-schema.js';
import { validateBudgetsConfig } from './budgets-schema.js';
import { validateFallbackConfig } from './fallback-schema.js';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('ConfigManager');

export interface ConfigFile {
  version: number;
  defaultProvider: string;
  defaultModel: string;
  providers: ProviderConfig[];
  routing: {
    strategy: string;
    rules: RoutingRule[];
  };
  budget: BudgetConfig;
  fallback: FallbackConfig;
  retries: number;
  timeout: number;
  encryption: {
    enabled: boolean;
    algorithm: string;
  };
  metadata: Record<string, unknown>;
}

export class ConfigManager {
  private config: ConfigFile;
  private encryption: ConfigEncryption;
  private migrator: ConfigMigrator;
  private watcher: ConfigWatcher | null = null;
  private filePath: string | null = null;
  private changeListeners: Array<(config: ConfigFile) => void> = [];

  constructor(config?: Partial<ConfigFile>) {
    this.config = ConfigDefaults.mergeWithDefaults(config);
    this.encryption = new ConfigEncryption();
    this.migrator = new ConfigMigrator();
  }

  static async fromFile(filePath: string, encryptionKey?: string): Promise<ConfigManager> {
    const fs = await import('fs/promises');
    const manager = new ConfigManager();
    manager.filePath = filePath;

    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(`Failed to parse config file: ${filePath}`);
      }

      const migrated = manager.migrator.migrate(parsed);
      let decrypted = migrated;

      if ((migrated as any).encryption?.enabled && encryptionKey) {
        decrypted = manager.encryption.decryptConfig(migrated, encryptionKey);
      }

      manager.config = ConfigDefaults.mergeWithDefaults(decrypted as Partial<ConfigFile>);
      logger.info('Config loaded from file', { path: filePath });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      logger.info('Config file not found, using defaults', { path: filePath });
    }

    return manager;
  }

  async saveToFile(filePath?: string, encryptionKey?: string): Promise<void> {
    const targetPath = filePath || this.filePath;
    if (!targetPath) {
      throw new Error('No file path specified for config save');
    }

    const fs = await import('fs/promises');
    let dataToSave = { ...this.config };

    if (encryptionKey) {
      dataToSave = this.encryption.encryptConfig(dataToSave, encryptionKey) as unknown as ConfigFile;
      dataToSave.encryption = { enabled: true, algorithm: 'aes-256-gcm' };
    }

    const dir = targetPath.substring(0, targetPath.lastIndexOf('/'));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(targetPath, JSON.stringify(dataToSave, null, 2), 'utf-8');
    logger.info('Config saved to file', { path: targetPath });
  }

  watch(callback: (config: ConfigFile) => void): void {
    if (!this.filePath) {
      logger.warn('Cannot watch config without a file path');
      return;
    }

    this.changeListeners.push(callback);

    if (!this.watcher) {
      this.watcher = new ConfigWatcher(this.filePath, async () => {
        try {
          const updated = await ConfigManager.fromFile(this.filePath!);
          this.config = updated.config;
          for (const listener of this.changeListeners) {
            listener(this.config);
          }
          logger.info('Config reloaded after file change');
        } catch (error) {
          logger.error('Failed to reload config after change', {
            error: (error as Error).message,
          });
        }
      });
      this.watcher.start();
    }
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.stop();
      this.watcher = null;
    }
    this.changeListeners = [];
  }

  getConfig(): ConfigFile {
    return { ...this.config };
  }

  getProvider(providerName: string): ProviderConfig | undefined {
    return this.config.providers.find((p) => p.provider === providerName);
  }

  getDefaultProvider(): ProviderConfig {
    const provider = this.config.providers.find(
      (p) => p.provider === this.config.defaultProvider,
    );
    if (!provider) {
      throw new Error(`Default provider not found: ${this.config.defaultProvider}`);
    }
    return provider;
  }

  getDefaultModel(): string {
    return this.config.defaultModel;
  }

  getRoutingStrategy(): string {
    return this.config.routing.strategy;
  }

  getRoutingRules(): RoutingRule[] {
    return [...this.config.routing.rules];
  }

  getBudgetConfig(): BudgetConfig {
    return { ...this.config.budget };
  }

  getFallbackConfig(): FallbackConfig {
    return { ...this.config.fallback };
  }

  updateProvider(providerName: string, updates: Partial<ProviderConfig>): void {
    const index = this.config.providers.findIndex((p) => p.provider === providerName);
    if (index === -1) {
      throw new Error(`Provider not found: ${providerName}`);
    }
    this.config.providers[index] = {
      ...this.config.providers[index],
      ...updates,
      provider: providerName as LLMProvider,
    };
    this.notifyChange();
  }

  addProvider(provider: ProviderConfig): void {
    const existing = this.config.providers.findIndex(
      (p) => p.provider === provider.provider,
    );
    if (existing !== -1) {
      throw new Error(`Provider already exists: ${provider.provider}`);
    }
    this.config.providers.push(provider);
    this.notifyChange();
  }

  removeProvider(providerName: string): void {
    const index = this.config.providers.findIndex((p) => p.provider === providerName);
    if (index === -1) {
      throw new Error(`Provider not found: ${providerName}`);
    }
    if (providerName === this.config.defaultProvider) {
      throw new Error('Cannot remove the default provider');
    }
    this.config.providers.splice(index, 1);
    this.notifyChange();
  }

  setDefaultProvider(providerName: string): void {
    const provider = this.config.providers.find((p) => p.provider === providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }
    this.config.defaultProvider = providerName;
    this.config.defaultModel = provider.defaultModel;
    this.notifyChange();
  }

  setDefaultModel(model: string): void {
    this.config.defaultModel = model;
    this.notifyChange();
  }

  setRoutingStrategy(strategy: string): void {
    const validStrategies = [
      'round_robin',
      'least_latency',
      'cost_optimized',
      'quality_optimized',
      'adaptive',
      'manual',
    ];
    if (!validStrategies.includes(strategy)) {
      throw new Error(`Invalid routing strategy: ${strategy}`);
    }
    this.config.routing.strategy = strategy;
    this.notifyChange();
  }

  addRoutingRule(rule: RoutingRule): void {
    this.config.routing.rules.push(rule);
    this.config.routing.rules.sort((a, b) => a.priority - b.priority);
    this.notifyChange();
  }

  removeRoutingRule(ruleId: string): void {
    this.config.routing.rules = this.config.routing.rules.filter(
      (r) => r.id !== ruleId,
    );
    this.notifyChange();
  }

  updateBudget(budget: Partial<BudgetConfig>): void {
    this.config.budget = { ...this.config.budget, ...budget };
    this.notifyChange();
  }

  updateFallback(fallback: Partial<FallbackConfig>): void {
    this.config.fallback = { ...this.config.fallback, ...fallback };
    this.notifyChange();
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const providerResult = validateProvidersConfig(this.config.providers);
    if (!providerResult.valid) errors.push(...providerResult.errors);

    const modelsResult = validateModelsConfig(
      this.config.providers,
      this.config.defaultModel,
    );
    if (!modelsResult.valid) errors.push(...modelsResult.errors);

    const routingResult = validateRoutingConfig(this.config.routing);
    if (!routingResult.valid) errors.push(...routingResult.errors);

    const budgetResult = validateBudgetsConfig(this.config.budget);
    if (!budgetResult.valid) errors.push(...budgetResult.errors);

    const fallbackResult = validateFallbackConfig(this.config.fallback);
    if (!fallbackResult.valid) errors.push(...fallbackResult.errors);

    if (!this.config.providers.find((p) => p.provider === this.config.defaultProvider)) {
      errors.push(
        `Default provider '${this.config.defaultProvider}' not found in providers list`,
      );
    }

    return { valid: errors.length === 0, errors };
  }

  toLLMConfig(): LLMConfig {
    return {
      defaultProvider: this.config.defaultProvider as LLMConfig['defaultProvider'],
      defaultModel: this.config.defaultModel,
      providers: this.config.providers,
      routing: this.config.routing.strategy as LLMConfig['routing'],
      budget: this.config.budget,
      fallback: this.config.fallback,
      retries: this.config.retries,
      timeout: this.config.timeout,
      metadata: this.config.metadata,
    };
  }

  private notifyChange(): void {
    for (const listener of this.changeListeners) {
      try {
        listener(this.config);
      } catch (error) {
        logger.error('Config change listener error', {
          error: (error as Error).message,
        });
      }
    }
  }

  destroy(): void {
    this.stopWatching();
    this.changeListeners = [];
  }
}
