import type { MemoryEntry } from "@paracosm/shared";
import { Result, ok, err } from "@paracosm/shared";
import type { MemoryStore, MemoryStoreMetadata } from "./types.js";
import { MemoryError } from "@paracosm/shared";
import { readFile, writeFile, mkdir, unlink, copyFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

const CURRENT_VERSION = 1;

export class MemoryPersistence {
  private basePath: string;
  private dirtyEntries: Set<string>;
  private lastSaveTime: number;
  private autoSaveIntervalMs: number;
  private autoSaveTimer: ReturnType<typeof setInterval> | null;

  constructor(basePath: string = "./data/memory") {
    this.basePath = basePath;
    this.dirtyEntries = new Set();
    this.lastSaveTime = 0;
    this.autoSaveIntervalMs = 30000;
    this.autoSaveTimer = null;
  }

  async save(store: MemoryStore, path: string): Promise<Result<void>> {
    try {
      const fullPath = join(this.basePath, path);
      await this.ensureDirectory(dirname(fullPath));

      const serialized = this.serializeStore(store);
      const data = JSON.stringify(serialized, null, 2);

      await writeFile(fullPath, data, "utf8");
      this.lastSaveTime = Date.now();
      this.dirtyEntries.clear();

      return ok(undefined);
    } catch (error) {
      return err(new MemoryError("Failed to save memory store", {
        path,
        error: String(error),
      }));
    }
  }

  async load(path: string): Promise<Result<MemoryStore>> {
    try {
      const fullPath = join(this.basePath, path);

      if (!existsSync(fullPath)) {
        return err(new MemoryError("Memory store file not found", { path }));
      }

      const data = await readFile(fullPath, "utf8");
      const parsed = JSON.parse(data);

      const version = parsed.version ?? 0;
      if (version !== CURRENT_VERSION) {
        const migrated = this.migrate(parsed, version);
        if (!migrated.ok) {
          return err(migrated.error);
        }
        return ok(migrated.value);
      }

      const store = this.deserializeStore(parsed);
      return ok(store);
    } catch (error) {
      return err(new MemoryError("Failed to load memory store", {
        path,
        error: String(error),
      }));
    }
  }

  async checkpoint(path: string): Promise<Result<void>> {
    try {
      const fullPath = join(this.basePath, path);
      await this.ensureDirectory(dirname(fullPath));

      const checkpointPath = fullPath.replace(/\.json$/, `.checkpoint.${Date.now()}.json`);

      if (existsSync(fullPath)) {
        await copyFile(fullPath, checkpointPath);
      }

      return ok(undefined);
    } catch (error) {
      return err(new MemoryError("Failed to create checkpoint", {
        path,
        error: String(error),
      }));
    }
  }

  migrate(data: Record<string, unknown>, version: number): Result<MemoryStore> {
    try {
      let current = { ...data };

      if (version < 1) {
        current = this.migrateV0toV1(current);
      }

      const store = this.deserializeStore(current);
      return ok(store);
    } catch (error) {
      return err(new MemoryError("Failed to migrate memory store", {
        fromVersion: version,
        toVersion: CURRENT_VERSION,
        error: String(error),
      }));
    }
  }

  async backup(path: string): Promise<Result<void>> {
    try {
      const fullPath = join(this.basePath, path);
      await this.ensureDirectory(dirname(fullPath));

      const backupPath = fullPath.replace(/\.json$/, `.backup.${Date.now()}.json`);

      if (existsSync(fullPath)) {
        await copyFile(fullPath, backupPath);
        return ok(undefined);
      }

      return err(new MemoryError("Source file not found for backup", { path }));
    } catch (error) {
      return err(new MemoryError("Failed to create backup", {
        path,
        error: String(error),
      }));
    }
  }

  async restore(path: string): Promise<Result<MemoryStore>> {
    try {
      const dir = join(this.basePath, dirname(path));
      const filePrefix = basename(path).replace(/\.json$/, "");

      if (!existsSync(dir)) {
        return err(new MemoryError("Backup directory not found", { path: dir }));
      }

      const files = await readdir(dir);
      const backupFiles = files
        .filter((f) => f.startsWith(filePrefix) && f.includes(".backup."))
        .sort()
        .reverse();

      if (backupFiles.length === 0) {
        return err(new MemoryError("No backup files found", { path }));
      }

      const latestBackup = join(dir, backupFiles[0]);
      const data = await readFile(latestBackup, "utf8");
      const parsed = JSON.parse(data);

      const store = this.deserializeStore(parsed);
      return ok(store);
    } catch (error) {
      return err(new MemoryError("Failed to restore from backup", {
        path,
        error: String(error),
      }));
    }
  }

  incrementalSave(changes: Array<{ id: string; entry: MemoryEntry; action: "add" | "update" | "delete" }>): void {
    for (const change of changes) {
      this.dirtyEntries.add(change.id);
    }
  }

  startAutoSave(getStore: () => MemoryStore, path: string): void {
    this.stopAutoSave();

    this.autoSaveTimer = setInterval(async () => {
      if (this.dirtyEntries.size > 0) {
        const store = getStore();
        await this.save(store, path);
      }
    }, this.autoSaveIntervalMs);
  }

  stopAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  getDirtyCount(): number {
    return this.dirtyEntries.size;
  }

  getLastSaveTime(): number {
    return this.lastSaveTime;
  }

  private serializeStore(store: MemoryStore): Record<string, unknown> {
    const working: Record<string, unknown> = {};
    for (const [key, value] of store.working) {
      working[key] = value;
    }

    const shortTerm: Record<string, unknown> = {};
    for (const [key, value] of store.shortTerm) {
      shortTerm[key] = value;
    }

    const longTerm: Record<string, unknown> = {};
    for (const [key, value] of store.longTerm) {
      longTerm[key] = value;
    }

    const episodic: Record<string, unknown> = {};
    for (const [key, value] of store.episodic) {
      episodic[key] = value;
    }

    const semantic: Record<string, unknown> = {};
    for (const [key, value] of store.semantic) {
      semantic[key] = value;
    }

    return {
      version: CURRENT_VERSION,
      metadata: store.metadata,
      working,
      shortTerm,
      longTerm,
      episodic,
      semantic,
      indices: {
        inverted: this.serializeMapOfSets(store.indices.inverted),
        vector: Object.fromEntries(store.indices.vector),
        temporal: Object.fromEntries(store.indices.temporal),
        facet: this.serializeNestedMap(store.indices.facet),
        tagIndex: this.serializeMapOfSets(store.indices.tagIndex),
        typeIndex: this.serializeMapOfSets(store.indices.typeIndex),
      },
    };
  }

  private deserializeStore(data: Record<string, unknown>): MemoryStore {
    return {
      metadata: (data.metadata as MemoryStoreMetadata) ?? {
        version: CURRENT_VERSION,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        entryCount: 0,
        totalSizeBytes: 0,
        lastConsolidatedAt: null,
        lastCompactedAt: null,
      },
      working: this.deserializeToMap(data.working as Record<string, unknown>),
      shortTerm: this.deserializeToMap(data.shortTerm as Record<string, unknown>),
      longTerm: this.deserializeToMap(data.longTerm as Record<string, unknown>),
      episodic: this.deserializeToMap(data.episodic as Record<string, unknown>),
      semantic: this.deserializeToMap(data.semantic as Record<string, unknown>),
      indices: {
        inverted: this.deserializeMapOfSets((data.indices as Record<string, unknown>)?.inverted as Record<string, unknown>),
        vector: new Map(Object.entries((data.indices as Record<string, unknown>)?.vector as Record<string, number[]> ?? {})),
        temporal: new Map(Object.entries((data.indices as Record<string, unknown>)?.temporal as Record<string, string> ?? {})),
        facet: this.deserializeNestedMap((data.indices as Record<string, unknown>)?.facet as Record<string, unknown>),
        tagIndex: this.deserializeMapOfSets((data.indices as Record<string, unknown>)?.tagIndex as Record<string, unknown>),
        typeIndex: this.deserializeMapOfSets((data.indices as Record<string, unknown>)?.typeIndex as Record<string, unknown>),
      },
    };
  }

  private migrateV0toV1(data: Record<string, unknown>): Record<string, unknown> {
    const migrated: Record<string, unknown> = { ...data, version: 1 };

    if (!migrated.metadata) {
      migrated.metadata = {
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        entryCount: 0,
        totalSizeBytes: 0,
        lastConsolidatedAt: null,
        lastCompactedAt: null,
      };
    }

    if (!migrated.indices) {
      migrated.indices = {
        inverted: {},
        vector: {},
        temporal: {},
        facet: {},
        tagIndex: {},
        typeIndex: {},
      };
    }

    return migrated;
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
    }
  }

  private serializeMapOfSets(map: Map<string, Set<string>>): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [key, set] of map) {
      result[key] = Array.from(set);
    }
    return result;
  }

  private serializeNestedMap(map: Map<string, Map<string, Set<string>>>): Record<string, Record<string, string[]>> {
    const result: Record<string, Record<string, string[]>> = {};
    for (const [key, innerMap] of map) {
      result[key] = {};
      for (const [innerKey, set] of innerMap) {
        result[key][innerKey] = Array.from(set);
      }
    }
    return result;
  }

  private deserializeToMap<T>(obj: Record<string, unknown>): Map<string, T> {
    const map = new Map<string, T>();
    if (obj) {
      for (const [key, value] of Object.entries(obj)) {
        map.set(key, value as T);
      }
    }
    return map;
  }

  private deserializeMapOfSets(obj: Record<string, unknown>): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    if (obj) {
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
          map.set(key, new Set(value as string[]));
        }
      }
    }
    return map;
  }

  private deserializeNestedMap(obj: Record<string, unknown>): Map<string, Map<string, Set<string>>> {
    const map = new Map<string, Map<string, Set<string>>>();
    if (obj) {
      for (const [key, value] of Object.entries(obj)) {
        const innerMap = new Map<string, Set<string>>();
        if (typeof value === "object" && value !== null) {
          for (const [innerKey, innerValue] of Object.entries(value as Record<string, unknown>)) {
            if (Array.isArray(innerValue)) {
              innerMap.set(innerKey, new Set(innerValue as string[]));
            }
          }
        }
        map.set(key, innerMap);
      }
    }
    return map;
  }
}

function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1];
}
