import { GeneType, CrossoverType } from "@paracosm/shared";
import { StrategyGene } from "../gene.js";
import type { DomainType, DomainProfile, ObjectiveWeights } from "../types.js";
import { DEFAULT_OBJECTIVE_WEIGHTS } from "../types.js";

const DOMAIN_PROFILES: Record<DomainType, DomainProfile> = {
  general: {
    domain: "general",
    characteristicFitnessWeights: { ...DEFAULT_OBJECTIVE_WEIGHTS },
    typicalMutationRates: 0.1,
    preferredCrossoverType: CrossoverType.SinglePoint,
    populationSize: 100,
    elitismRatio: 0.05,
    diversityThreshold: 0.3,
    stagnationPatience: 20,
  },
  creative: {
    domain: "creative",
    characteristicFitnessWeights: {
      effectiveness: 0.2,
      efficiency: 0.1,
      robustness: 0.1,
      novelty: 0.4,
      simplicity: 0.2,
    },
    typicalMutationRates: 0.15,
    preferredCrossoverType: CrossoverType.Uniform,
    populationSize: 120,
    elitismRatio: 0.03,
    diversityThreshold: 0.4,
    stagnationPatience: 30,
  },
  analytical: {
    domain: "analytical",
    characteristicFitnessWeights: {
      effectiveness: 0.35,
      efficiency: 0.25,
      robustness: 0.2,
      novelty: 0.1,
      simplicity: 0.1,
    },
    typicalMutationRates: 0.05,
    preferredCrossoverType: CrossoverType.Blend,
    populationSize: 80,
    elitismRatio: 0.1,
    diversityThreshold: 0.2,
    stagnationPatience: 15,
  },
  social: {
    domain: "social",
    characteristicFitnessWeights: {
      effectiveness: 0.25,
      efficiency: 0.15,
      robustness: 0.2,
      novelty: 0.2,
      simplicity: 0.2,
    },
    typicalMutationRates: 0.1,
    preferredCrossoverType: CrossoverType.TwoPoint,
    populationSize: 100,
    elitismRatio: 0.05,
    diversityThreshold: 0.35,
    stagnationPatience: 25,
  },
  technical: {
    domain: "technical",
    characteristicFitnessWeights: {
      effectiveness: 0.3,
      efficiency: 0.25,
      robustness: 0.25,
      novelty: 0.1,
      simplicity: 0.1,
    },
    typicalMutationRates: 0.08,
    preferredCrossoverType: CrossoverType.SinglePoint,
    populationSize: 90,
    elitismRatio: 0.08,
    diversityThreshold: 0.25,
    stagnationPatience: 18,
  },
  strategic: {
    domain: "strategic",
    characteristicFitnessWeights: {
      effectiveness: 0.35,
      efficiency: 0.2,
      robustness: 0.2,
      novelty: 0.15,
      simplicity: 0.1,
    },
    typicalMutationRates: 0.07,
    preferredCrossoverType: CrossoverType.Blend,
    populationSize: 80,
    elitismRatio: 0.1,
    diversityThreshold: 0.3,
    stagnationPatience: 20,
  },
  operational: {
    domain: "operational",
    characteristicFitnessWeights: {
      effectiveness: 0.3,
      efficiency: 0.3,
      robustness: 0.2,
      novelty: 0.05,
      simplicity: 0.15,
    },
    typicalMutationRates: 0.05,
    preferredCrossoverType: CrossoverType.SinglePoint,
    populationSize: 70,
    elitismRatio: 0.12,
    diversityThreshold: 0.2,
    stagnationPatience: 15,
  },
};

const DOMAIN_KEYWORDS: Record<DomainType, string[]> = {
  general: [],
  creative: ["create", "design", "art", "write", "compose", "imagine", "invent", "brainstorm", "novel", "original"],
  analytical: ["analyze", "compute", "calculate", "measure", "evaluate", "compare", "statistic", "data", "metric", "insight"],
  social: ["communicate", "collaborate", "team", "user", "audience", "community", "engage", "interact", "share", "discuss"],
  technical: ["implement", "code", "build", "deploy", "optimize", "debug", "refactor", "architect", "system", "engineer"],
  strategic: ["plan", "strategy", "goal", "objective", "roadmap", "vision", "priority", "decision", "outcome", "impact"],
  operational: ["execute", "run", "monitor", "maintain", "schedule", "process", "workflow", "automate", "operate", "manage"],
};

export class DomainAdaptation {
  private domainProfiles: Map<DomainType, DomainProfile>;
  private domainGeneTemplates: Map<DomainType, StrategyGene[]>;

  constructor() {
    this.domainProfiles = new Map();
    this.domainGeneTemplates = new Map();

    for (const [domain, profile] of Object.entries(DOMAIN_PROFILES)) {
      this.domainProfiles.set(domain as DomainType, profile);
    }

    this.initializeDomainTemplates();
  }

  detectDomain(context: string): DomainType {
    const normalizedContext = context.toLowerCase();
    const domainScores: Record<string, number> = {};

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      if (domain === "general") {
        domainScores[domain] = 0.1;
        continue;
      }

      let score = 0;
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, "gi");
        const matches = normalizedContext.match(regex);
        if (matches) {
          score += matches.length;
        }
      }
      domainScores[domain] = score;
    }

    let bestDomain: DomainType = "general";
    let bestScore = 0;

    for (const [domain, score] of Object.entries(domainScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain as DomainType;
      }
    }

    return bestDomain;
  }

  loadDomainStrategies(domain: DomainType): StrategyGene[] {
    const templates = this.domainGeneTemplates.get(domain);
    if (templates) {
      return templates.map((g) => g.clone());
    }
    return [];
  }

  crossDomainTransfer(source: DomainType, target: DomainType): StrategyGene[] {
    const sourceGenes = this.domainGeneTemplates.get(source) ?? [];
    const targetProfile = this.domainProfiles.get(target);
    if (!targetProfile || sourceGenes.length === 0) {
      return [];
    }

    const transferred: StrategyGene[] = [];

    for (const sourceGene of sourceGenes) {
      const adapted = sourceGene.clone();
      adapted.origin = "migration";
      adapted.applicability = [target];

      const sourceProfile = this.domainProfiles.get(source);
      if (sourceProfile) {
        const fitnessAdjustment = computeFitnessAdjustment(
          sourceProfile.characteristicFitnessWeights,
          targetProfile.characteristicFitnessWeights
        );
        adapted.fitness = Math.max(0, Math.min(1, adapted.fitness * fitnessAdjustment));
      }

      adapted.expression = {
        ...adapted.expression,
        priority: adapted.expression.priority * 0.8,
        weight: adapted.fitness,
      };

      transferred.push(adapted);
    }

    return transferred;
  }

  getDomainProfile(domain: DomainType): DomainProfile | null {
    return this.domainProfiles.get(domain) ?? null;
  }

  getAllDomains(): DomainType[] {
    return Array.from(this.domainProfiles.keys());
  }

  setDomainProfile(domain: DomainType, profile: Partial<DomainProfile>): void {
    const existing = this.domainProfiles.get(domain);
    if (existing) {
      this.domainProfiles.set(domain, { ...existing, ...profile });
    } else {
      this.domainProfiles.set(domain, {
        domain,
        characteristicFitnessWeights: profile.characteristicFitnessWeights ?? { ...DEFAULT_OBJECTIVE_WEIGHTS },
        typicalMutationRates: profile.typicalMutationRates ?? 0.1,
        preferredCrossoverType: profile.preferredCrossoverType ?? CrossoverType.SinglePoint,
        populationSize: profile.populationSize ?? 100,
        elitismRatio: profile.elitismRatio ?? 0.05,
        diversityThreshold: profile.diversityThreshold ?? 0.3,
        stagnationPatience: profile.stagnationPatience ?? 20,
      });
    }
  }

  private initializeDomainTemplates(): void {
    const domains: DomainType[] = ["creative", "analytical", "social", "technical", "strategic", "operational"];

    for (const domain of domains) {
      const templates: StrategyGene[] = [];

      templates.push(
        StrategyGene.create({
          trigger: `${domain}_condition_primary`,
          actionTemplate: `${domain}_action_primary`,
          evaluation: `${domain}_evaluation`,
          name: `${domain}_primary_strategy`,
          type: GeneType.Policy,
          description: `Primary strategy for ${domain} domain`,
          applicability: [domain],
        })
      );

      templates.push(
        StrategyGene.create({
          trigger: `${domain}_condition_secondary`,
          actionTemplate: `${domain}_action_secondary`,
          evaluation: `${domain}_evaluation_secondary`,
          name: `${domain}_secondary_strategy`,
          type: GeneType.Heuristic,
          description: `Secondary strategy for ${domain} domain`,
          applicability: [domain],
        })
      );

      templates.push(
        StrategyGene.create({
          trigger: `${domain}_condition_fallback`,
          actionTemplate: `${domain}_action_fallback`,
          evaluation: `${domain}_evaluation_fallback`,
          name: `${domain}_fallback_strategy`,
          type: GeneType.Rule,
          description: `Fallback strategy for ${domain} domain`,
          applicability: [domain],
          fitness: 0.3,
        })
      );

      this.domainGeneTemplates.set(domain, templates);
    }
  }
}

function computeFitnessAdjustment(
  sourceWeights: ObjectiveWeights,
  targetWeights: ObjectiveWeights
): number {
  let dotProduct = 0;
  let sourceNorm = 0;
  let targetNorm = 0;

  const keys = Object.keys(sourceWeights) as Array<keyof ObjectiveWeights>;
  for (const key of keys) {
    dotProduct += sourceWeights[key] * targetWeights[key];
    sourceNorm += sourceWeights[key] * sourceWeights[key];
    targetNorm += targetWeights[key] * targetWeights[key];
  }

  sourceNorm = Math.sqrt(sourceNorm);
  targetNorm = Math.sqrt(targetNorm);

  if (sourceNorm === 0 || targetNorm === 0) {
    return 0.5;
  }

  const cosineSimilarity = dotProduct / (sourceNorm * targetNorm);
  return 0.5 + cosineSimilarity * 0.5;
}
