import { GeneType } from "@paracosm/shared";
import { StrategyGene } from "../gene.js";
import { GenePool } from "../gene-pool.js";
import type { ContextProfile, DomainType, ObjectiveWeights } from "../types.js";
import { DEFAULT_OBJECTIVE_WEIGHTS } from "../types.js";
import { DomainAdaptation } from "./domain-adaptation.js";

export interface Situation {
  description: string;
  domain?: DomainType;
  urgency?: number;
  complexity?: number;
  resourceAvailability?: number;
  constraints?: string[];
  preferredGeneTypes?: GeneType[];
  metadata?: Record<string, unknown>;
}

export class ContextAdaptation {
  private domainAdaptation: DomainAdaptation;
  private contextHistory: ContextProfile[];
  private currentContext: ContextProfile | null;
  private contextGeneAffinities: Map<string, Map<string, number>>;

  constructor(domainAdaptation?: DomainAdaptation) {
    this.domainAdaptation = domainAdaptation ?? new DomainAdaptation();
    this.contextHistory = [];
    this.currentContext = null;
    this.contextGeneAffinities = new Map();
  }

  analyzeContext(situation: Situation): ContextProfile {
    const domain = situation.domain ?? this.domainAdaptation.detectDomain(situation.description);
    const urgency = situation.urgency ?? this.inferUrgency(situation.description);
    const complexity = situation.complexity ?? this.inferComplexity(situation.description);
    const resourceAvailability = situation.resourceAvailability ?? this.inferResourceAvailability(situation.description);
    const constraints = situation.constraints ?? this.inferConstraints(situation.description);
    const preferredGeneTypes = situation.preferredGeneTypes ?? this.inferPreferredGeneTypes(domain);
    const fitnessModifiers = this.computeFitnessModifiers(domain, urgency, complexity);

    const profile: ContextProfile = {
      id: `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      situation: situation.description,
      domain,
      urgency,
      complexity,
      resourceAvailability,
      constraints,
      preferredGeneTypes,
      fitnessModifiers,
      timestamp: new Date().toISOString(),
    };

    this.contextHistory.push(profile);
    if (this.contextHistory.length > 100) {
      this.contextHistory = this.contextHistory.slice(-50);
    }

    return profile;
  }

  selectStrategy(context: ContextProfile, pool: GenePool): StrategyGene {
    const candidates = pool.getActiveGenes();
    if (candidates.length === 0) {
      throw new Error("No active genes in pool to select from");
    }

    const scored = candidates.map((gene) => {
      let score = gene.fitness;

      if (context.preferredGeneTypes.includes(gene.type)) {
        score += 0.15;
      }

      const applicabilityOverlap = this.computeApplicabilityOverlap(gene, context);
      score += applicabilityOverlap * 0.2;

      if (context.urgency > 0.7) {
        score += gene.expression.priority * 0.1;
      }

      if (context.complexity > 0.7) {
        score += (1 - gene.expression.priority) * 0.05;
      }

      if (context.resourceAvailability < 0.3) {
        score += (1 - gene.expression.weight) * 0.05;
      }

      const constraintCompatibility = this.computeConstraintCompatibility(gene, context);
      score += constraintCompatibility * 0.15;

      const affinity = this.getContextGeneAffinity(context.id, gene.id as string);
      score += affinity * 0.1;

      return { gene, score };
    });

    scored.sort((a, b) => b.score - a.score);

    if (context.urgency > 0.8) {
      return scored[0].gene;
    }

    const topN = Math.min(5, scored.length);
    const topCandidates = scored.slice(0, topN);
    const totalScore = topCandidates.reduce((sum, s) => sum + s.score, 0);
    let threshold = Math.random() * totalScore;

    for (const candidate of topCandidates) {
      threshold -= candidate.score;
      if (threshold <= 0) {
        return candidate.gene;
      }
    }

    return topCandidates[0].gene;
  }

  adjustParameters(gene: StrategyGene, context: ContextProfile): StrategyGene {
    const adjusted = gene.clone();

    const expression = { ...adjusted.expression };

    if (context.urgency > 0.7) {
      expression.priority = Math.min(1, expression.priority + 0.2);
    } else if (context.urgency < 0.3) {
      expression.priority = Math.max(0, expression.priority - 0.1);
    }

    if (context.complexity > 0.7) {
      expression.weight = Math.min(1, expression.weight + 0.1);
    }

    if (context.resourceAvailability < 0.3) {
      expression.weight = Math.max(0, expression.weight - 0.15);
    }

    adjusted.expression = expression;

    if (context.fitnessModifiers) {
      const modifiers = context.fitnessModifiers;
      let fitnessDelta = 0;
      for (const key of Object.keys(modifiers) as Array<keyof ObjectiveWeights>) {
        if (modifiers[key] !== undefined) {
          fitnessDelta += (modifiers[key]! - DEFAULT_OBJECTIVE_WEIGHTS[key]) * 0.1;
        }
      }
      adjusted.fitness = Math.max(0, Math.min(1, adjusted.fitness + fitnessDelta));
    }

    if (!adjusted.applicability.includes(context.domain)) {
      adjusted.applicability = [...adjusted.applicability, context.domain];
    }

    return adjusted;
  }

  contextSwitch(oldContext: ContextProfile | null, newContext: ContextProfile): void {
    if (oldContext) {
      this.updateContextGeneAffinities(oldContext);
    }

    this.currentContext = newContext;

    const domainGenes = this.domainAdaptation.loadDomainStrategies(newContext.domain);
    for (const gene of domainGenes) {
      this.setContextGeneAffinity(newContext.id, gene.id as string, 0.5);
    }
  }

  getCurrentContext(): ContextProfile | null {
    return this.currentContext;
  }

  getContextHistory(): ContextProfile[] {
    return [...this.contextHistory];
  }

  private inferUrgency(description: string): number {
    const urgentKeywords = ["urgent", "critical", "immediate", "asap", "emergency", "now", "deadline"];
    const lowKeywords = ["eventually", "someday", "when possible", "low priority", "no rush"];

    const lower = description.toLowerCase();
    let score = 0.5;

    for (const keyword of urgentKeywords) {
      if (lower.includes(keyword)) {
        score += 0.15;
      }
    }

    for (const keyword of lowKeywords) {
      if (lower.includes(keyword)) {
        score -= 0.15;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  private inferComplexity(description: string): number {
    const complexKeywords = ["complex", "complicated", "intricate", "multi-step", "advanced", "sophisticated"];
    const simpleKeywords = ["simple", "basic", "straightforward", "easy", "trivial"];

    const lower = description.toLowerCase();
    let score = 0.5;

    for (const keyword of complexKeywords) {
      if (lower.includes(keyword)) {
        score += 0.15;
      }
    }

    for (const keyword of simpleKeywords) {
      if (lower.includes(keyword)) {
        score -= 0.15;
      }
    }

    const wordCount = description.split(/\s+/).length;
    if (wordCount > 50) {
      score += 0.1;
    } else if (wordCount < 10) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  private inferResourceAvailability(description: string): number {
    const scarceKeywords = ["limited", "constrained", "budget", "minimal", "scarce"];
    const abundantKeywords = ["abundant", "unlimited", "plenty", "available", "resource-rich"];

    const lower = description.toLowerCase();
    let score = 0.5;

    for (const keyword of scarceKeywords) {
      if (lower.includes(keyword)) {
        score -= 0.15;
      }
    }

    for (const keyword of abundantKeywords) {
      if (lower.includes(keyword)) {
        score += 0.15;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  private inferConstraints(description: string): string[] {
    const constraints: string[] = [];
    const lower = description.toLowerCase();

    if (lower.includes("time limit") || lower.includes("deadline")) {
      constraints.push("temporal");
    }
    if (lower.includes("budget") || lower.includes("cost")) {
      constraints.push("financial");
    }
    if (lower.includes("security") || lower.includes("compliance")) {
      constraints.push("regulatory");
    }
    if (lower.includes("performance") || lower.includes("latency")) {
      constraints.push("performance");
    }

    return constraints;
  }

  private inferPreferredGeneTypes(domain: DomainType): GeneType[] {
    const domainTypeMap: Record<DomainType, GeneType[]> = {
      general: [GeneType.Heuristic, GeneType.Rule],
      creative: [GeneType.Pattern, GeneType.Heuristic],
      analytical: [GeneType.Rule, GeneType.Policy],
      social: [GeneType.Heuristic, GeneType.Pattern],
      technical: [GeneType.Rule, GeneType.Procedure],
      strategic: [GeneType.Policy, GeneType.Heuristic],
      operational: [GeneType.Procedure, GeneType.Rule],
    };
    return domainTypeMap[domain] ?? [GeneType.Heuristic];
  }

  private computeFitnessModifiers(domain: DomainType, urgency: number, complexity: number): Partial<ObjectiveWeights> {
    const profile = this.domainAdaptation.getDomainProfile(domain);
    if (!profile) {
      return {};
    }

    const modifiers: Partial<ObjectiveWeights> = {};

    if (urgency > 0.7) {
      modifiers.effectiveness = (profile.characteristicFitnessWeights.effectiveness ?? 0.3) * 1.2;
      modifiers.efficiency = (profile.characteristicFitnessWeights.efficiency ?? 0.2) * 1.1;
    }

    if (complexity > 0.7) {
      modifiers.robustness = (profile.characteristicFitnessWeights.robustness ?? 0.2) * 1.2;
      modifiers.novelty = (profile.characteristicFitnessWeights.novelty ?? 0.15) * 0.8;
    }

    return modifiers;
  }

  private computeApplicabilityOverlap(gene: StrategyGene, context: ContextProfile): number {
    if (gene.applicability.length === 0) {
      return 0;
    }
    const geneSet = new Set(gene.applicability);
    let overlap = 0;
    if (geneSet.has(context.domain)) {
      overlap += 0.5;
    }
    for (const constraint of context.constraints) {
      if (geneSet.has(constraint)) {
        overlap += 0.25;
      }
    }
    return Math.min(1, overlap);
  }

  private computeConstraintCompatibility(gene: StrategyGene, context: ContextProfile): number {
    if (context.constraints.length === 0) {
      return 1;
    }

    const geneConstraints = new Set(gene.constraints);
    let compatible = 0;
    for (const constraint of context.constraints) {
      if (geneConstraints.has(constraint)) {
        compatible += 1;
      }
    }
    return compatible / context.constraints.length;
  }

  private getContextGeneAffinity(contextId: string, geneId: string): number {
    const geneAffinities = this.contextGeneAffinities.get(contextId);
    if (!geneAffinities) {
      return 0;
    }
    return geneAffinities.get(geneId) ?? 0;
  }

  private setContextGeneAffinity(contextId: string, geneId: string, affinity: number): void {
    let geneAffinities = this.contextGeneAffinities.get(contextId);
    if (!geneAffinities) {
      geneAffinities = new Map();
      this.contextGeneAffinities.set(contextId, geneAffinities);
    }
    geneAffinities.set(geneId, affinity);
  }

  private updateContextGeneAffinities(context: ContextProfile): void {
    const geneAffinities = this.contextGeneAffinities.get(context.id);
    if (geneAffinities) {
      for (const [geneId, affinity] of geneAffinities) {
        geneAffinities.set(geneId, affinity * 0.9);
      }
    }
  }
}
