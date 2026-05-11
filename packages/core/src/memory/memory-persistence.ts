import type { MemoryEntry } from '@paracosm/shared';
import { ok, err, type Result, createLogger } from '@paracosm/shared';

const logger = createLogger('MemoryPersistence');

export class MemoryPersistence {
  private storage: Map<string, string> = new Map();

  async save(key: string, entries: MemoryEntry[]): Promise<Result<boolean>> {
    try {
      const serialized = JSON.stringify(entries.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
        lastAccessedAt: e.lastAccessedAt?.toISOString(),
      })));
      this.storage.set(key, serialized);
      logger.info(`Saved ${entries.length} memory entries with key: ${key}`);
      return ok(true);
    } catch (error) {
      return err(new Error(`Failed to save: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  async load(key: string): Promise<Result<MemoryEntry[]>> {
    try {
      const serialized = this.storage.get(key);
      if (!serialized) return err(new Error(`No data found for key: ${key}`));
      const data = JSON.parse(serialized);
      const entries: MemoryEntry[] = data.map((e: Record<string, unknown>) => ({
        ...e,
        createdAt: new Date(e.createdAt as string),
        lastAccessedAt: e.lastAccessedAt ? new Date(e.lastAccessedAt as string) : undefined,
      }));
      logger.info(`Loaded ${entries.length} memory entries from key: ${key}`);
      return ok(entries);
    } catch (error) {
      return err(new Error(`Failed to load: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  async delete(key: string): Promise<Result<boolean>> {
    if (!this.storage.has(key)) return err(new Error(`No data found for key: ${key}`));
    this.storage.delete(key);
    return ok(true);
  }

  listKeys(): string[] {
    return Array.from(this.storage.keys());
  }

  clear(): void {
    this.storage.clear();
  }
}
