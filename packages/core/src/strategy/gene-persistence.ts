import type { StrategyGene } from '@paracosm/shared';
import { GeneSerializer } from './gene-serializer.js';
import { ok, err, type Result, createLogger } from '@paracosm/shared';

const logger = createLogger('GenePersistence');

export class GenePersistence {
  private serializer: GeneSerializer;
  private storage: Map<string, string> = new Map();

  constructor() {
    this.serializer = new GeneSerializer();
  }

  async save(key: string, genes: StrategyGene[]): Promise<Result<boolean>> {
    try {
      const json = this.serializer.serializeAll(genes);
      this.storage.set(key, json);
      logger.info(`Saved ${genes.length} genes with key: ${key}`);
      return ok(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err(new Error(`Failed to save genes: ${message}`));
    }
  }

  async load(key: string): Promise<Result<StrategyGene[]>> {
    try {
      const json = this.storage.get(key);
      if (!json) {
        return err(new Error(`No genes found for key: ${key}`));
      }
      const genes = this.serializer.deserializeAll(json);
      logger.info(`Loaded ${genes.length} genes from key: ${key}`);
      return ok(genes);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err(new Error(`Failed to load genes: ${message}`));
    }
  }

  async delete(key: string): Promise<Result<boolean>> {
    if (!this.storage.has(key)) {
      return err(new Error(`No genes found for key: ${key}`));
    }
    this.storage.delete(key);
    return ok(true);
  }

  listKeys(): string[] {
    return Array.from(this.storage.keys());
  }

  hasKey(key: string): boolean {
    return this.storage.has(key);
  }

  clear(): void {
    this.storage.clear();
  }
}
