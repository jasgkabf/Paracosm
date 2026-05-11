import { GeneType } from "@paracosm/shared";
import { StrategyGene } from "./gene.js";
import type { GeneInternal, GenePoolData } from "./types.js";
import { Result, ok, err } from "@paracosm/shared";
import { base64Encode, base64Decode } from "@paracosm/shared";
import { safeParse, safeStringify } from "@paracosm/shared";

const SERIALIZER_VERSION = 1;

export class GeneSerializer {
  private version: number;

  constructor() {
    this.version = SERIALIZER_VERSION;
  }

  serialize(gene: StrategyGene): string {
    const data = gene.serialize();
    const versioned = {
      version: this.version,
      type: "gene",
      data,
    };
    const stringResult = safeStringify(versioned);
    if (!stringResult.ok) {
      throw new Error(`Failed to serialize gene: ${stringResult.error}`);
    }
    return base64Encode(stringResult.value);
  }

  deserialize(data: string): StrategyGene {
    const decoded = base64Decode(data);
    const parseResult = safeParse<SerializedGene>(decoded);
    if (!parseResult.ok) {
      throw new Error(`Failed to deserialize gene: ${parseResult.error}`);
    }

    const parsed = parseResult.value;
    if (parsed.version !== this.version) {
      const migrated = this.migrateGeneData(parsed);
      return this.dataToGene(migrated);
    }

    return this.dataToGene(parsed.data);
  }

  compress(genes: StrategyGene[]): Buffer {
    const serialized: SerializedGene[] = genes.map((gene) => ({
      version: this.version,
      type: "gene",
      data: gene.serialize(),
    }));

    const stringResult = safeStringify(serialized);
    if (!stringResult.ok) {
      throw new Error(`Failed to compress genes: ${stringResult.error}`);
    }

    const encoded = base64Encode(stringResult.value);
    return Buffer.from(encoded, "utf8");
  }

  decompress(data: Buffer): StrategyGene[] {
    const encoded = data.toString("utf8");
    const decoded = base64Decode(encoded);
    const parseResult = safeParse<SerializedGene[]>(decoded);
    if (!parseResult.ok) {
      throw new Error(`Failed to decompress genes: ${parseResult.error}`);
    }

    return parseResult.value.map((item) => {
      if (item.version !== this.version) {
        const migrated = this.migrateGeneData(item);
        return this.dataToGene(migrated);
      }
      return this.dataToGene(item.data);
    });
  }

  migrateVersion(data: string, fromVersion: number, toVersion: number): string {
    const decoded = base64Decode(data);
    const parseResult = safeParse<SerializedGene>(decoded);
    if (!parseResult.ok) {
      throw new Error(`Failed to parse data for migration: ${parseResult.error}`);
    }

    const parsed = parseResult.value;

    let current = parsed;
    for (let v = fromVersion; v < toVersion; v++) {
      current = this.applyMigration(current, v, v + 1);
    }

    const stringResult = safeStringify(current);
    if (!stringResult.ok) {
      throw new Error(`Failed to stringify migrated data: ${stringResult.error}`);
    }

    return base64Encode(stringResult.value);
  }

  getVersion(): number {
    return this.version;
  }

  private dataToGene(data: unknown): StrategyGene {
    const geneData = data as Record<string, unknown>;
    const expression = geneData.expression as Record<string, unknown>;

    const gene = StrategyGene.create({
      trigger: expression.condition as string,
      actionTemplate: expression.action as string,
      evaluation: "",
      name: geneData.name as string,
      type: geneData.type as GeneType,
      description: geneData.description as string,
      applicability: (geneData.applicability as string[]) ?? [],
      constraints: (geneData.constraints as string[]) ?? [],
      targetGoals: (geneData.targetGoals as string[]) ?? [],
      fitness: geneData.fitness as number,
    });

    return gene;
  }

  private migrateGeneData(serialized: SerializedGene): Record<string, unknown> {
    const data = serialized.data as Record<string, unknown>;
    let migrated = { ...data };

    if (serialized.version < 1) {
      if (!migrated.applicability) {
        migrated.applicability = [];
      }
      if (!migrated.constraints) {
        migrated.constraints = [];
      }
      if (!migrated.targetGoals) {
        migrated.targetGoals = [];
      }
    }

    return migrated;
  }

  private applyMigration(data: SerializedGene, fromVersion: number, toVersion: number): SerializedGene {
    const migrated = { ...data };

    if (fromVersion === 0 && toVersion === 1) {
      const geneData = migrated.data as Record<string, unknown>;
      if (!geneData.applicability) {
        geneData.applicability = [];
      }
      if (!geneData.constraints) {
        geneData.constraints = [];
      }
      if (!geneData.targetGoals) {
        geneData.targetGoals = [];
      }
      migrated.data = geneData;
    }

    migrated.version = toVersion;
    return migrated;
  }
}

interface SerializedGene {
  version: number;
  type: string;
  data: unknown;
}
