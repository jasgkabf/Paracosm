import type { StrategyGene, AdaptationResult } from '@paracosm/shared';
import { generateId, createLogger } from '@paracosm/shared';

const logger = createLogger('UserAdaptation');

export interface UserProfile {
  id: string;
  preferences: Record<string, number>;
  interactionPatterns: Map<string, number>;
  adaptationHistory: Array<{ timestamp: Date; adjustment: string; impact: number }>;
}

export class UserAdaptation {
  private profiles: Map<string, UserProfile> = new Map();

  adapt(gene: StrategyGene, userId: string, feedback: number): StrategyGene {
    const profile = this.getOrCreateProfile(userId);
    const preferenceKey = `${gene.type}_${gene.name}`;
    const currentPref = profile.preferences[preferenceKey] ?? 0.5;
    const adaptedPref = currentPref * 0.8 + feedback * 0.2;
    profile.preferences[preferenceKey] = adaptedPref;
    const adjustmentFactor = 1 + (adaptedPref - 0.5) * 0.2;
    if (typeof gene.value === 'number') {
      return {
        ...gene,
        value: (gene.value as number) * adjustmentFactor,
        metadata: { ...gene.metadata, userAdapted: true, userId, adjustmentFactor },
      };
    }
    return {
      ...gene,
      metadata: { ...gene.metadata, userAdapted: true, userId, preference: adaptedPref },
    };
  }

  getPreference(userId: string, geneType: string, geneName: string): number {
    const profile = this.profiles.get(userId);
    if (!profile) return 0.5;
    return profile.preferences[`${geneType}_${geneName}`] ?? 0.5;
  }

  getProfile(userId: string): UserProfile | undefined {
    return this.profiles.get(userId);
  }

  private getOrCreateProfile(userId: string): UserProfile {
    let profile = this.profiles.get(userId);
    if (!profile) {
      profile = {
        id: userId,
        preferences: {},
        interactionPatterns: new Map(),
        adaptationHistory: [],
      };
      this.profiles.set(userId, profile);
    }
    return profile;
  }

  clear(): void {
    this.profiles.clear();
  }
}
