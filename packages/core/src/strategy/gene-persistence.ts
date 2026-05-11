import { readFile, writeFile, mkdir, unlink, rename, stat, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { GenePool } from "./gene-pool.js";
import { StrategyGene } from "./gene.js";
import { GeneSerializer } from "./gene-serializer.js";
import type { GenePoolData, GeneInternal } from "./types.js";
import { safeParse, safeStringify } from "@paracosm/shared";
import { hash } from "@paracosm/shared";

const CURRENT_VERSION = 1;

export class GenePersistence {
  private serializer: GeneSerializer;
  private basePath: string;

  constructor(basePath?: string) {
    this.serializer = new GeneSerializer();
    this.basePath = basePath ?? "./data/genes";
  }

  async save(pool: GenePool, path: string): Promise<Result<true, Error>> {
    try {
      const fullPath = this.resolvePath(path);
      await this.ensureDirectory(dirname(fullPath));

      const data = this.poolToData(pool);
      const stringResult = safeStringify(data, 2);
      if (!stringResult.ok) {
        return err(new Error(`Failed to serialize pool: ${stringResult.error}`));
      }

      await writeFile(fullPath, stringResult.value, "utf8");
      return ok(true);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async load(path: string): Promise<Result<GenePoolData, Error>> {
    try {
      const fullPath = this.resolvePath(path);
      if (!existsSync(fullPath)) {
        return err(new Error(`File not found: ${fullPath}`));
      }

      const content = await readFile(fullPath, "utf8");
      const parseResult = safeParse<GenePoolData>(content);
      if (!parseResult.ok) {
        return err(new Error(`Failed to parse pool data: ${parseResult.error}`));
      }

      const data = parseResult.value;
      if (data.version !== CURRENT_VERSION) {
        const migrated = this.migrateData(data, data.version, CURRENT_VERSION);
        return ok(migrated);
      }

      return ok(data);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async backup(pool: GenePool, path: string): Promise<Result<true, Error>> {
    try {
      const fullPath = this.resolvePath(path);
      await this.ensureDirectory(dirname(fullPath));

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = join(dirname(fullPath), `backup_${timestamp}_${basename(fullPath)}`);

      const data = this.poolToData(pool);
      const stringResult = safeStringify(data, 2);
      if (!stringResult.ok) {
        return err(new Error(`Failed to serialize pool for backup: ${stringResult.error}`));
      }

      await writeFile(backupPath, stringResult.value, "utf8");
      return ok(true);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async restore(path: string): Promise<Result<GenePoolData, Error>> {
    try {
      const fullPath = this.resolvePath(path);
      if (!existsSync(fullPath)) {
        return err(new Error(`Backup file not found: ${fullPath}`));
      }

      const content = await readFile(fullPath, "utf8");
      const parseResult = safeParse<GenePoolData>(content);
      if (!parseResult.ok) {
        return err(new Error(`Failed to parse backup data: ${parseResult.error}`));
      }

      return ok(parseResult.value);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  migrate(data: GenePoolData, version: number): GenePoolData {
    return this.migrateData(data, data.version, version);
  }

  async compact(path: string): Promise<Result<true, Error>> {
    try {
      const fullPath = this.resolvePath(path);
      if (!existsSync(fullPath)) {
        return err(new Error(`File not found: ${fullPath}`));
      }

      const loadResult = await this.load(path);
      if (!loadResult.ok) {
        return err(loadResult.error);
      }

      const data = loadResult.value;
      const pool = this.dataToPool(data);
      const compactedData = this.poolToData(pool);

      const stringResult = safeStringify(compactedData);
      if (!stringResult.ok) {
        return err(new Error(`Failed to compact data: ${stringResult.error}`));
      }

      const tempPath = fullPath + ".tmp";
      await writeFile(tempPath, stringResult.value, "utf8");
      await rename(tempPath, fullPath);

      return ok(true);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  dataToPool(data: GenePoolData): GenePool {
    const pool = new GenePool();

    for (const geneData of data.genes) {
      const gene = StrategyGene.create({
        trigger: geneData.expression.condition,
        actionTemplate: geneData.expression.action,
        evaluation: "",
        name: geneData.name,
        type: geneData.type as any,
        description: geneData.description,
        applicability: geneData.applicability,
        constraints: geneData.constraints,
        targetGoals: geneData.targetGoals,
        fitness: geneData.fitness,
      });
      pool.add(gene);
    }

    pool.setGeneration(data.generation);
    if (data.protectedIds) {
      pool.protect(data.protectedIds);
    }

    return pool;
  }

  poolToData(pool: GenePool): GenePoolData {
    const genes = pool.getAllGenes();
    const geneDataList: GenePoolData["genes"] = genes.map((gene) => {
      const serialized = gene.serialize() as Record<string, unknown>;
      return {
        id: serialized.id as string,
        name: serialized.name as string,
        type: serialized.type as string,
        description: serialized.description as string,
        expression: serialized.expression as GenePoolData["genes"][0]["expression"],
        fitness: serialized.fitness as number,
        generation: serialized.generation as number,
        parentId: serialized.parentId as string | null,
        origin: serialized.origin as string,
        active: serialized.active as boolean,
        applicability: serialized.applicability as string[],
        constraints: serialized.constraints as string[],
        targetGoals: serialized.targetGoals as string[],
        createdAt: serialized.createdAt as string,
        updatedAt: serialized.updatedAt as string,
      };
    });

    const stats = pool.stats();

    return {
      genes: geneDataList,
      generation: pool.getGeneration(),
      speciesCount: stats.speciesCount,
      totalFitness: stats.averageFitness * stats.size,
      averageFitness: stats.averageFitness,
      diversityIndex: stats.diversityIndex,
      stagnationCount: pool.getStagnationCount(),
      protectedIds: [],
      version: CURRENT_VERSION,
      checksum: hash(JSON.stringify(geneDataList)),
    };
  }

  private migrateData(data: GenePoolData, fromVersion: number, toVersion: number): GenePoolData {
    let migrated = { ...data };

    for (let v = fromVersion; v < toVersion; v++) {
      if (v === 0) {
        if (!migrated.protectedIds) {
          migrated.protectedIds = [];
        }
        if (!migrated.version) {
          migrated.version = 1;
        }
        if (!migrated.checksum) {
          migrated.checksum = "";
        }
      }
    }

    migrated.version = toVersion;
    return migrated;
  }

  private resolvePath(path: string): string {
    if (path.startsWith("/")) {
      return path;
    }
    return join(this.basePath, path);
  }

  private async ensureDirectory(dir: string): Promise<void> {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}

function basename(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1];
}
