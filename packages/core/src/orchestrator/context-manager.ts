import type {
  ContextWindow,
  ContextPlan,
  AnalysisResult,
} from "./types.js";
import type {
  Entity,
  EntityId,
  Goal,
  Constraint,
  WorldModelState,
  RelationType,
  EntityType,
} from "@paracosm/shared";
import { generateId } from "@paracosm/shared";

interface RelevanceScore {
  entityId: string;
  score: number;
  reasons: string[];
}

interface TokenEstimate {
  entityTokens: number;
  relationTokens: number;
  goalTokens: number;
  constraintTokens: number;
  totalTokens: number;
}

const AVERAGE_TOKENS_PER_WORD = 1.3;
const WORDS_PER_ENTITY = 50;
const WORDS_PER_RELATION = 20;
const WORDS_PER_GOAL = 30;
const WORDS_PER_CONSTRAINT = 25;

export class ContextManager {
  private contextCache: Map<string, ContextWindow>;
  private maxCacheSize: number;

  constructor(maxCacheSize: number = 100) {
    this.contextCache = new Map();
    this.maxCacheSize = maxCacheSize;
  }

  buildContext(worldModel: WorldModelState, query: string): ContextWindow {
    const cacheKey = this.computeCacheKey(worldModel, query);
    const cached = this.contextCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const relevantEntities = this.selectRelevant(worldModel, query, 20);
    const relevantGoals = this.selectRelevantGoals(worldModel, query, 10);
    const relevantConstraints = this.selectRelevantConstraints(worldModel, query, 10);
    const relevantRelations = this.selectRelevantRelations(worldModel, relevantEntities, 30);

    const tokenEstimate = this.estimateTokens(
      relevantEntities.length,
      relevantRelations.length,
      relevantGoals.length,
      relevantConstraints.length
    );

    const context: ContextWindow = {
      id: generateId(),
      query,
      entities: relevantEntities,
      relations: relevantRelations.map((r) => ({
        sourceId: r.sourceId,
        targetId: r.targetId,
        type: r.type as string,
        weight: r.weight,
      })),
      goals: relevantGoals,
      constraints: relevantConstraints,
      tokenCount: tokenEstimate.totalTokens,
      maxTokens: 8000,
      priority: 1,
      createdAt: new Date().toISOString(),
    };

    this.cacheContext(cacheKey, context);
    return context;
  }

  optimizeForWindow(context: ContextWindow, maxTokens: number): ContextWindow {
    if (context.tokenCount <= maxTokens) {
      return context;
    }

    const scoredEntities = context.entities.map((entity) => ({
      entity,
      score: this.scoreEntityRelevance(entity, context.query),
    }));

    scoredEntities.sort((a, b) => b.score - a.score);

    let currentTokens = 0;
    const selectedEntities: Entity[] = [];
    const selectedEntityIds = new Set<string>();

    for (const { entity, score } of scoredEntities) {
      const entityTokens = Math.ceil(WORDS_PER_ENTITY * AVERAGE_TOKENS_PER_WORD);
      if (currentTokens + entityTokens > maxTokens * 0.5) {
        break;
      }
      selectedEntities.push(entity);
      selectedEntityIds.add(entity.id);
      currentTokens += entityTokens;
    }

    const filteredRelations = context.relations.filter(
      (r) => selectedEntityIds.has(r.sourceId as string) && selectedEntityIds.has(r.targetId as string)
    );
    currentTokens += filteredRelations.length * Math.ceil(WORDS_PER_RELATION * AVERAGE_TOKENS_PER_WORD);

    const remainingTokens = maxTokens - currentTokens;
    const goalTokens = Math.ceil(WORDS_PER_GOAL * AVERAGE_TOKENS_PER_WORD);
    const constraintTokens = Math.ceil(WORDS_PER_CONSTRAINT * AVERAGE_TOKENS_PER_WORD);

    const maxGoals = Math.min(context.goals.length, Math.floor(remainingTokens * 0.6 / goalTokens));
    const maxConstraints = Math.min(
      context.constraints.length,
      Math.floor(remainingTokens * 0.4 / constraintTokens)
    );

    const selectedGoals = context.goals
      .sort((a, b) => a.priority - b.priority)
      .slice(0, maxGoals);

    const selectedConstraints = context.constraints
      .sort((a, b) => a.priority - b.priority)
      .slice(0, maxConstraints);

    const optimized: ContextWindow = {
      id: generateId(),
      query: context.query,
      entities: selectedEntities,
      relations: filteredRelations,
      goals: selectedGoals,
      constraints: selectedConstraints,
      tokenCount: this.estimateTokens(
        selectedEntities.length,
        filteredRelations.length,
        selectedGoals.length,
        selectedConstraints.length
      ).totalTokens,
      maxTokens,
      priority: context.priority,
      createdAt: new Date().toISOString(),
    };

    return optimized;
  }

  selectRelevant(worldModel: WorldModelState, query: string, maxItems: number): Entity[] {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

    const scores: RelevanceScore[] = [];

    for (const [entityId, entity] of worldModel.entityGraph.entities) {
      let score = 0;
      const reasons: string[] = [];

      const nameLower = entity.name.toLowerCase();
      const descLower = entity.description.toLowerCase();

      for (const term of queryTerms) {
        if (nameLower.includes(term)) {
          score += 3;
          reasons.push(`name_match:${term}`);
        }
        if (descLower.includes(term)) {
          score += 2;
          reasons.push(`description_match:${term}`);
        }
        for (const tag of entity.tags) {
          if (tag.toLowerCase().includes(term)) {
            score += 1.5;
            reasons.push(`tag_match:${term}`);
          }
        }
        for (const prop of entity.properties) {
          if (String(prop.value).toLowerCase().includes(term)) {
            score += 1;
            reasons.push(`property_match:${term}`);
          }
        }
      }

      const adjacency = worldModel.entityGraph.adjacency.get(entityId);
      if (adjacency && adjacency.length > 0) {
        score += Math.min(adjacency.length * 0.1, 1);
        reasons.push("connected");
      }

      if (score > 0) {
        scores.push({ entityId: entity.id, score, reasons });
      }
    }

    scores.sort((a, b) => b.score - a.score);

    const selectedIds = new Set(scores.slice(0, maxItems).map((s) => s.entityId));
    const result: Entity[] = [];
    for (const [_, entity] of worldModel.entityGraph.entities) {
      if (selectedIds.has(entity.id)) {
        result.push(entity);
      }
    }

    return result.slice(0, maxItems);
  }

  compressContext(context: ContextWindow, targetTokens: number): ContextWindow {
    if (context.tokenCount <= targetTokens) {
      return context;
    }

    const compressionRatio = targetTokens / context.tokenCount;

    const entityCount = Math.max(1, Math.floor(context.entities.length * compressionRatio));
    const relationCount = Math.max(0, Math.floor(context.relations.length * compressionRatio));
    const goalCount = Math.max(1, Math.floor(context.goals.length * compressionRatio));
    const constraintCount = Math.max(0, Math.floor(context.constraints.length * compressionRatio));

    const scoredEntities = context.entities
      .map((entity) => ({ entity, score: this.scoreEntityRelevance(entity, context.query) }))
      .sort((a, b) => b.score - a.score);

    const compressedEntities = scoredEntities.slice(0, entityCount).map((e) => e.entity);
    const compressedEntityIds = new Set(compressedEntities.map((e) => e.id));

    const compressedRelations = context.relations
      .filter(
        (r) =>
          compressedEntityIds.has(r.sourceId as string) && compressedEntityIds.has(r.targetId as string)
      )
      .slice(0, relationCount);

    const compressedGoals = context.goals
      .sort((a, b) => a.priority - b.priority)
      .slice(0, goalCount);

    const compressedConstraints = context.constraints
      .sort((a, b) => a.priority - b.priority)
      .slice(0, constraintCount);

    return {
      id: generateId(),
      query: context.query,
      entities: compressedEntities,
      relations: compressedRelations,
      goals: compressedGoals,
      constraints: compressedConstraints,
      tokenCount: this.estimateTokens(
        compressedEntities.length,
        compressedRelations.length,
        compressedGoals.length,
        compressedConstraints.length
      ).totalTokens,
      maxTokens: targetTokens,
      priority: context.priority,
      createdAt: new Date().toISOString(),
    };
  }

  expandContext(context: ContextWindow, additionalItems: Entity[]): ContextWindow {
    const existingIds = new Set(context.entities.map((e) => e.id));
    const newEntities = additionalItems.filter((e) => !existingIds.has(e.id));

    if (newEntities.length === 0) {
      return context;
    }

    const allEntities = [...context.entities, ...newEntities];
    const allEntityIds = new Set(allEntities.map((e) => e.id));

    const expandedRelations = context.relations.filter(
      (r) => allEntityIds.has(r.sourceId as string) || allEntityIds.has(r.targetId as string)
    );

    const additionalTokenEstimate = this.estimateTokens(
      allEntities.length,
      expandedRelations.length,
      context.goals.length,
      context.constraints.length
    );

    return {
      id: generateId(),
      query: context.query,
      entities: allEntities,
      relations: expandedRelations,
      goals: context.goals,
      constraints: context.constraints,
      tokenCount: additionalTokenEstimate.totalTokens,
      maxTokens: context.maxTokens,
      priority: context.priority,
      createdAt: new Date().toISOString(),
    };
  }

  private scoreEntityRelevance(entity: Entity, query: string): number {
    let score = 0;
    const queryLower = query.toLowerCase();
    const terms = queryLower.split(/\s+/).filter((t) => t.length > 2);

    for (const term of terms) {
      if (entity.name.toLowerCase().includes(term)) {
        score += 3;
      }
      if (entity.description.toLowerCase().includes(term)) {
        score += 2;
      }
      for (const tag of entity.tags) {
        if (tag.toLowerCase().includes(term)) {
          score += 1.5;
        }
      }
    }

    return score;
  }

  private selectRelevantGoals(worldModel: WorldModelState, query: string, maxItems: number): Goal[] {
    const queryLower = query.toLowerCase();
    const terms = queryLower.split(/\s+/).filter((t) => t.length > 2);

    const scored = Array.from(worldModel.goalStack.goals.values())
      .map((goal) => {
        let score = 0;
        const nameLower = goal.name.toLowerCase();
        const descLower = goal.description.toLowerCase();
        for (const term of terms) {
          if (nameLower.includes(term)) score += 3;
          if (descLower.includes(term)) score += 2;
        }
        score += (5 - goal.priority) * 0.5;
        if (goal.state === "active" || goal.state === "in_progress") score += 2;
        return { goal, score };
      })
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, maxItems).map((s) => s.goal);
  }

  private selectRelevantConstraints(
    worldModel: WorldModelState,
    query: string,
    maxItems: number
  ): Constraint[] {
    const queryLower = query.toLowerCase();
    const terms = queryLower.split(/\s+/).filter((t) => t.length > 2);

    const scored = Array.from(worldModel.constraintMap.constraints.values())
      .map((constraint) => {
        let score = 0;
        const nameLower = constraint.name.toLowerCase();
        const descLower = constraint.description.toLowerCase();
        for (const term of terms) {
          if (nameLower.includes(term)) score += 3;
          if (descLower.includes(term)) score += 2;
        }
        score += constraint.priority * 0.3;
        if (constraint.status === "active") score += 2;
        if (constraint.type === "hard") score += 1;
        return { constraint, score };
      })
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, maxItems).map((s) => s.constraint);
  }

  private selectRelevantRelations(
    worldModel: WorldModelState,
    entities: Entity[],
    maxItems: number
  ): Array<{ sourceId: EntityId; targetId: EntityId; type: string; weight: number }> {
    const entityIds = new Set(entities.map((e) => e.id));
    const relations: Array<{
      sourceId: EntityId;
      targetId: EntityId;
      type: string;
      weight: number;
    }> = [];

    for (const [_, relation] of worldModel.entityGraph.relations) {
      if (entityIds.has(relation.sourceId) || entityIds.has(relation.targetId)) {
        relations.push({
          sourceId: relation.sourceId,
          targetId: relation.targetId,
          type: relation.type as string,
          weight: relation.weight,
        });
      }
      if (relations.length >= maxItems) {
        break;
      }
    }

    return relations.sort((a, b) => b.weight - a.weight).slice(0, maxItems);
  }

  private estimateTokens(
    entityCount: number,
    relationCount: number,
    goalCount: number,
    constraintCount: number
  ): TokenEstimate {
    const entityTokens = Math.ceil(entityCount * WORDS_PER_ENTITY * AVERAGE_TOKENS_PER_WORD);
    const relationTokens = Math.ceil(relationCount * WORDS_PER_RELATION * AVERAGE_TOKENS_PER_WORD);
    const goalTokens = Math.ceil(goalCount * WORDS_PER_GOAL * AVERAGE_TOKENS_PER_WORD);
    const constraintTokens = Math.ceil(constraintCount * WORDS_PER_CONSTRAINT * AVERAGE_TOKENS_PER_WORD);

    return {
      entityTokens,
      relationTokens,
      goalTokens,
      constraintTokens,
      totalTokens: entityTokens + relationTokens + goalTokens + constraintTokens,
    };
  }

  private computeCacheKey(worldModel: WorldModelState, query: string): string {
    return `${worldModel.checksum}:${query.substring(0, 100)}`;
  }

  private cacheContext(key: string, context: ContextWindow): void {
    if (this.contextCache.size >= this.maxCacheSize) {
      const firstKey = this.contextCache.keys().next().value;
      if (firstKey !== undefined) {
        this.contextCache.delete(firstKey);
      }
    }
    this.contextCache.set(key, context);
  }

  clearCache(): void {
    this.contextCache.clear();
  }
}
