import { GeneType } from "@paracosm/shared";
import { StrategyGene } from "../gene.js";
import { GenePool } from "../gene-pool.js";
import type { UserPattern, ObjectiveWeights, GeneInternal } from "../types.js";
import { DEFAULT_OBJECTIVE_WEIGHTS } from "../types.js";

export interface UserFeedback {
  geneId: string;
  rating: number;
  context?: string;
  timestamp?: string;
  explicit?: boolean;
}

interface UserData {
  patterns: UserPattern[];
  feedbackHistory: UserFeedback[];
  weights: ObjectiveWeights;
  geneRatings: Map<string, number[]>;
  geneTypePreferences: Map<string, number>;
  lastUpdated: string;
}

export class UserAdaptation {
  private userData: Map<string, UserData>;
  private patternThreshold: number;
  private adaptationDecay: number;

  constructor() {
    this.userData = new Map();
    this.patternThreshold = 0.3;
    this.adaptationDecay = 0.95;
  }

  learnFromUser(userId: string, geneId: string, feedback: UserFeedback): void {
    let data = this.getOrCreateUserData(userId);

    data.feedbackHistory.push({
      ...feedback,
      geneId,
      timestamp: feedback.timestamp ?? new Date().toISOString(),
    });

    if (data.feedbackHistory.length > 1000) {
      data.feedbackHistory = data.feedbackHistory.slice(-500);
    }

    const ratings = data.geneRatings.get(geneId) ?? [];
    ratings.push(feedback.rating);
    data.geneRatings.set(geneId, ratings);

    this.updateGeneTypePreferences(data, geneId, feedback.rating);

    this.detectPatternsFromFeedback(userId, data, geneId, feedback);

    this.updateWeightsFromFeedback(data, feedback);

    data.lastUpdated = new Date().toISOString();
  }

  adaptStrategies(userId: string, pool: GenePool): GenePool {
    const data = this.userData.get(userId);
    if (!data) {
      return pool;
    }

    const adaptedPool = new GenePool();
    const genes = pool.getAllGenes();

    for (const gene of genes) {
      const adaptedGene = this.adaptGeneToUser(gene, data);
      adaptedPool.add(adaptedGene);
    }

    const protectedIds = data.feedbackHistory
      .filter((f) => f.rating >= 0.8)
      .map((f) => f.geneId)
      .filter((id) => adaptedPool.has(id));
    adaptedPool.protect(protectedIds);

    return adaptedPool;
  }

  trackPatterns(userId: string): UserPattern[] {
    const data = this.userData.get(userId);
    if (!data) {
      return [];
    }
    return [...data.patterns];
  }

  personalizeWeights(userId: string): ObjectiveWeights {
    const data = this.userData.get(userId);
    if (!data) {
      return { ...DEFAULT_OBJECTIVE_WEIGHTS };
    }
    return { ...data.weights };
  }

  getUserData(userId: string): { feedbackCount: number; patternCount: number; lastUpdated: string } | null {
    const data = this.userData.get(userId);
    if (!data) {
      return null;
    }
    return {
      feedbackCount: data.feedbackHistory.length,
      patternCount: data.patterns.length,
      lastUpdated: data.lastUpdated,
    };
  }

  private getOrCreateUserData(userId: string): UserData {
    let data = this.userData.get(userId);
    if (!data) {
      data = {
        patterns: [],
        feedbackHistory: [],
        weights: { ...DEFAULT_OBJECTIVE_WEIGHTS },
        geneRatings: new Map(),
        geneTypePreferences: new Map(),
        lastUpdated: new Date().toISOString(),
      };
      this.userData.set(userId, data);
    }
    return data;
  }

  private updateGeneTypePreferences(data: UserData, geneId: string, rating: number): void {
    const normalizedRating = rating > 0.7 ? 1 : rating < 0.3 ? -1 : 0;

    const geneTypes = Object.values(GeneType);
    for (const type of geneTypes) {
      const current = data.geneTypePreferences.get(type) ?? 0;
      const delta = normalizedRating * 0.1;
      data.geneTypePreferences.set(type, current + delta);
    }
  }

  private detectPatternsFromFeedback(userId: string, data: UserData, geneId: string, feedback: UserFeedback): void {
    if (feedback.rating >= 0.8) {
      const existingPreference = data.patterns.find(
        (p) => p.patternType === "preference" && p.geneId === geneId
      );
      if (existingPreference) {
        existingPreference.frequency++;
        existingPreference.recency = 1;
        existingPreference.strength = Math.min(1, existingPreference.strength + 0.1);
        existingPreference.detectedAt = new Date().toISOString();
      } else {
        data.patterns.push({
          userId,
          patternType: "preference",
          geneId,
          geneType: null,
          frequency: 1,
          recency: 1,
          strength: 0.5,
          metadata: { rating: feedback.rating },
          detectedAt: new Date().toISOString(),
        });
      }
    }

    if (feedback.rating <= 0.2) {
      const existingAvoidance = data.patterns.find(
        (p) => p.patternType === "avoidance" && p.geneId === geneId
      );
      if (existingAvoidance) {
        existingAvoidance.frequency++;
        existingAvoidance.recency = 1;
        existingAvoidance.strength = Math.min(1, existingAvoidance.strength + 0.1);
        existingAvoidance.detectedAt = new Date().toISOString();
      } else {
        data.patterns.push({
          userId,
          patternType: "avoidance",
          geneId,
          geneType: null,
          frequency: 1,
          recency: 1,
          strength: 0.5,
          metadata: { rating: feedback.rating },
          detectedAt: new Date().toISOString(),
        });
      }
    }

    const recentFeedback = data.feedbackHistory.slice(-10);
    if (recentFeedback.length >= 3) {
      const highRatedTypes = new Map<string, number>();
      for (const fb of recentFeedback) {
        if (fb.rating >= 0.7) {
          const count = highRatedTypes.get(fb.geneId) ?? 0;
          highRatedTypes.set(fb.geneId, count + 1);
        }
      }

      for (const [gid, count] of highRatedTypes) {
        if (count >= 2) {
          const existing = data.patterns.find(
            (p) => p.patternType === "frequency" && p.geneId === gid
          );
          if (existing) {
            existing.frequency = count;
            existing.strength = Math.min(1, count / 5);
          } else {
            data.patterns.push({
              userId,
              patternType: "frequency",
              geneId: gid,
              geneType: null,
              frequency: count,
              recency: 1,
              strength: Math.min(1, count / 5),
              metadata: {},
              detectedAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    if (data.patterns.length > 200) {
      data.patterns.sort((a, b) => b.strength - a.strength);
      data.patterns = data.patterns.slice(0, 100);
    }

    for (const pattern of data.patterns) {
      pattern.recency *= this.adaptationDecay;
    }
  }

  private updateWeightsFromFeedback(data: UserData, feedback: UserFeedback): void {
    const rating = feedback.rating;

    if (rating >= 0.7) {
      data.weights.effectiveness = Math.min(1, data.weights.effectiveness + 0.02);
      data.weights.efficiency = Math.min(1, data.weights.efficiency + 0.01);
    } else if (rating <= 0.3) {
      data.weights.novelty = Math.min(1, data.weights.novelty + 0.02);
      data.weights.robustness = Math.min(1, data.weights.robustness + 0.01);
    }

    const total = Object.values(data.weights).reduce((sum, w) => sum + w, 0);
    if (total > 0) {
      for (const key of Object.keys(data.weights) as Array<keyof ObjectiveWeights>) {
        data.weights[key] = data.weights[key] / total;
      }
    }
  }

  private adaptGeneToUser(gene: StrategyGene, data: UserData): StrategyGene {
    const adapted = gene.clone();

    const preferencePattern = data.patterns.find(
      (p) => p.patternType === "preference" && p.geneId === (gene.id as string)
    );
    if (preferencePattern) {
      adapted.fitness = Math.min(1, adapted.fitness + preferencePattern.strength * 0.1);
    }

    const avoidancePattern = data.patterns.find(
      (p) => p.patternType === "avoidance" && p.geneId === (gene.id as string)
    );
    if (avoidancePattern) {
      adapted.fitness = Math.max(0, adapted.fitness - avoidancePattern.strength * 0.1);
    }

    const typePreference = data.geneTypePreferences.get(gene.type) ?? 0;
    if (typePreference > 0) {
      adapted.fitness = Math.min(1, adapted.fitness + typePreference * 0.05);
    } else if (typePreference < 0) {
      adapted.fitness = Math.max(0, adapted.fitness + typePreference * 0.05);
    }

    return adapted;
  }
}
