import type { StrategyGene, AdaptationResult } from '@paracosm/shared';
import { generateId, createLogger } from '@paracosm/shared';

const logger = createLogger('DomainAdaptation');

export interface DomainConfig {
  domain: string;
  constraints: Array<{ name: string; validate: (value: unknown) => boolean; penalty: number }>;
  scalingFactors: Record<string, number>;
  bounds: Record<string, { min: number; max: number }>;
}

export class DomainAdaptation {
  private domains: Map<string, DomainConfig> = new Map();

  registerDomain(config: DomainConfig): void {
    this.domains.set(config.domain, config);
    logger.info(`Registered domain: ${config.domain}`);
  }

  adapt(gene: StrategyGene, domain: string): StrategyGene {
    const config = this.domains.get(domain);
    if (!config) return gene;
    let adaptedValue = gene.value;
    const scalingFactor = config.scalingFactors[gene.type] ?? 1.0;
    if (typeof adaptedValue === 'number') {
      adaptedValue = (adaptedValue as number) * scalingFactor;
      const bounds = config.bounds[gene.type];
      if (bounds) {
        adaptedValue = Math.min(Math.max(adaptedValue as number, bounds.min), bounds.max);
      }
    }
    let penalty = 0;
    for (const constraint of config.constraints) {
      if (!constraint.validate(adaptedValue)) {
        penalty += constraint.penalty;
      }
    }
    const adaptedFitness = Math.max(gene.fitness - penalty, 0);
    return {
      ...gene,
      value: adaptedValue,
      fitness: adaptedFitness,
      metadata: { ...gene.metadata, domainAdapted: true, domain, penalty },
    };
  }

  validate(gene: StrategyGene, domain: string): { valid: boolean; violations: string[] } {
    const config = this.domains.get(domain);
    if (!config) return { valid: true, violations: [] };
    const violations: string[] = [];
    for (const constraint of config.constraints) {
      if (!constraint.validate(gene.value)) {
        violations.push(constraint.name);
      }
    }
    return { valid: violations.length === 0, violations };
  }

  getDomain(domain: string): DomainConfig | undefined {
    return this.domains.get(domain);
  }

  clear(): void {
    this.domains.clear();
  }
}
