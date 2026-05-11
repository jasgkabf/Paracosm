import { EntityGraph } from './entity-graph.js';
import { Timeline } from './timeline.js';
import { ConstraintMap } from './constraint-map.js';
import { GoalStack } from './goal-stack.js';
import type { WorldModelConfig } from './types.js';
import { DEFAULT_WORLD_MODEL_CONFIG } from './types.js';
import { ok, err, type Result } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('GraphPersistence');

export interface PersistenceData {
  version: number;
  timestamp: string;
  config: WorldModelConfig;
  entities: Array<{
    id: string;
    name: string;
    type: string;
    description: string;
    attributes: Record<string, unknown>;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }>;
  relations: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    type: string;
    strength: number;
    description: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
  events: Array<{
    id: string;
    name: string;
    description: string;
    timestamp: string;
    entities: string[];
    consequences: string[];
    probability: number;
    metadata: Record<string, unknown>;
  }>;
  causalLinks: Array<{
    id: string;
    causeEventId: string;
    effectEventId: string;
    strength: number;
    delay: number;
    description: string;
    metadata: Record<string, unknown>;
  }>;
  constraints: Array<{
    id: string;
    name: string;
    type: string;
    expression: string;
    description: string;
    priority: number;
    enabled: boolean;
    metadata: Record<string, unknown>;
  }>;
  goals: Array<{
    id: string;
    name: string;
    description: string;
    priority: string;
    state: string;
    constraints: string[];
    subGoals: string[];
    progress: number;
    deadline?: string;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }>;
}

export class GraphPersistence {
  private config: WorldModelConfig;
  private storage: Map<string, PersistenceData> = new Map();

  constructor(config: WorldModelConfig = DEFAULT_WORLD_MODEL_CONFIG) {
    this.config = config;
  }

  async save(
    key: string,
    entityGraph: EntityGraph,
    timeline: Timeline,
    constraintMap: ConstraintMap,
    goalStack: GoalStack,
    version: number,
  ): Promise<Result<boolean>> {
    try {
      const data: PersistenceData = {
        version,
        timestamp: new Date().toISOString(),
        config: this.config,
        entities: Array.from(entityGraph.getAllEntities().values()).map((e) => ({
          id: e.id,
          name: e.name,
          type: e.type,
          description: e.description,
          attributes: e.attributes,
          metadata: e.metadata,
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        })),
        relations: Array.from(entityGraph.getAllRelations().values()).map((r) => ({
          id: r.id,
          sourceId: r.sourceId,
          targetId: r.targetId,
          type: r.type,
          strength: r.strength,
          description: r.description,
          metadata: r.metadata,
          createdAt: r.createdAt.toISOString(),
        })),
        events: timeline.getAllEvents().map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          timestamp: e.timestamp.toISOString(),
          entities: e.entities,
          consequences: e.consequences,
          probability: e.probability,
          metadata: e.metadata,
        })),
        causalLinks: timeline.getAllCausalLinks().map((l) => ({
          id: l.id,
          causeEventId: l.causeEventId,
          effectEventId: l.effectEventId,
          strength: l.strength,
          delay: l.delay,
          description: l.description,
          metadata: l.metadata,
        })),
        constraints: constraintMap.getAllConstraints().map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          expression: c.expression,
          description: c.description,
          priority: c.priority,
          enabled: c.enabled,
          metadata: c.metadata,
        })),
        goals: goalStack.getAllGoals().map((g) => ({
          id: g.id,
          name: g.name,
          description: g.description,
          priority: g.priority,
          state: g.state,
          constraints: g.constraints,
          subGoals: g.subGoals,
          progress: g.progress,
          deadline: g.deadline?.toISOString(),
          metadata: g.metadata,
          createdAt: g.createdAt.toISOString(),
          updatedAt: g.updatedAt.toISOString(),
        })),
      };
      this.storage.set(key, data);
      logger.info(`Saved world model state with key: ${key}`, { version, entityCount: data.entities.length });
      return ok(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to save world model state: ${message}`);
      return err(new Error(`Failed to save: ${message}`));
    }
  }

  async load(key: string): Promise<Result<PersistenceData>> {
    try {
      const data = this.storage.get(key);
      if (!data) {
        return err(new Error(`No saved state found for key: ${key}`));
      }
      logger.info(`Loaded world model state with key: ${key}`, { version: data.version });
      return ok(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load world model state: ${message}`);
      return err(new Error(`Failed to load: ${message}`));
    }
  }

  async delete(key: string): Promise<Result<boolean>> {
    if (!this.storage.has(key)) {
      return err(new Error(`No saved state found for key: ${key}`));
    }
    this.storage.delete(key);
    logger.info(`Deleted world model state with key: ${key}`);
    return ok(true);
  }

  listSaves(): string[] {
    return Array.from(this.storage.keys());
  }

  hasSave(key: string): boolean {
    return this.storage.has(key);
  }

  getSaveInfo(key: string): { version: number; timestamp: string; entityCount: number } | null {
    const data = this.storage.get(key);
    if (!data) return null;
    return {
      version: data.version,
      timestamp: data.timestamp,
      entityCount: data.entities.length,
    };
  }
}
