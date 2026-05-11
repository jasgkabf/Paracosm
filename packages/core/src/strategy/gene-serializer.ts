import type { StrategyGene } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('GeneSerializer');

export interface SerializedGene {
  id: string;
  name: string;
  type: string;
  value: string;
  fitness: number;
  generation: number;
  parentIds: string;
  mutationCount: number;
  metadata: string;
  createdAt: string;
}

export class GeneSerializer {
  serialize(gene: StrategyGene): SerializedGene {
    return {
      id: gene.id,
      name: gene.name,
      type: gene.type,
      value: JSON.stringify(gene.value),
      fitness: gene.fitness,
      generation: gene.generation,
      parentIds: JSON.stringify(gene.parentIds),
      mutationCount: gene.mutationCount,
      metadata: JSON.stringify(gene.metadata),
      createdAt: gene.createdAt.toISOString(),
    };
  }

  deserialize(data: SerializedGene): StrategyGene {
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      value: JSON.parse(data.value),
      fitness: data.fitness,
      generation: data.generation,
      parentIds: JSON.parse(data.parentIds),
      mutationCount: data.mutationCount,
      metadata: JSON.parse(data.metadata),
      createdAt: new Date(data.createdAt),
    };
  }

  serializeAll(genes: StrategyGene[]): string {
    const serialized = genes.map((g) => this.serialize(g));
    return JSON.stringify(serialized);
  }

  deserializeAll(json: string): StrategyGene[] {
    const data: SerializedGene[] = JSON.parse(json);
    return data.map((d) => this.deserialize(d));
  }
}
