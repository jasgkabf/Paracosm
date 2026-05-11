import type { MemoryEntry } from '@paracosm/shared';
import { generateId, ok, type Result, createLogger } from '@paracosm/shared';

const logger = createLogger('SemanticMemory');

export interface SemanticNode {
  id: string;
  concept: string;
  properties: Record<string, unknown>;
  relations: Array<{ targetId: string; relationType: string; strength: number }>;
  createdAt: Date;
  updatedAt: Date;
}

export class SemanticMemory {
  private nodes: Map<string, SemanticNode> = new Map();
  private conceptIndex: Map<string, string> = new Map();

  addConcept(concept: string, properties?: Record<string, unknown>): Result<SemanticNode> {
    const existingId = this.conceptIndex.get(concept.toLowerCase());
    if (existingId) {
      const existing = this.nodes.get(existingId)!;
      existing.properties = { ...existing.properties, ...properties };
      existing.updatedAt = new Date();
      return ok(existing);
    }
    const node: SemanticNode = {
      id: generateId(),
      concept,
      properties: properties ?? {},
      relations: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.nodes.set(node.id, node);
    this.conceptIndex.set(concept.toLowerCase(), node.id);
    return ok(node);
  }

  addRelation(fromConcept: string, toConcept: string, relationType: string, strength: number = 1.0): Result<boolean> {
    const fromId = this.conceptIndex.get(fromConcept.toLowerCase());
    const toId = this.conceptIndex.get(toConcept.toLowerCase());
    if (!fromId || !toId) return ok(false);
    const fromNode = this.nodes.get(fromId);
    if (!fromNode) return ok(false);
    const existing = fromNode.relations.find((r) => r.targetId === toId && r.relationType === relationType);
    if (existing) {
      existing.strength = strength;
    } else {
      fromNode.relations.push({ targetId: toId, relationType, strength });
    }
    fromNode.updatedAt = new Date();
    return ok(true);
  }

  getConcept(concept: string): SemanticNode | undefined {
    const id = this.conceptIndex.get(concept.toLowerCase());
    if (!id) return undefined;
    return this.nodes.get(id);
  }

  getRelatedConcepts(concept: string, relationType?: string): SemanticNode[] {
    const node = this.getConcept(concept);
    if (!node) return [];
    const relations = relationType
      ? node.relations.filter((r) => r.relationType === relationType)
      : node.relations;
    return relations
      .map((r) => this.nodes.get(r.targetId))
      .filter((n): n is SemanticNode => n !== undefined);
  }

  search(query: string, limit: number = 10): SemanticNode[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.nodes.values())
      .filter((n) => n.concept.toLowerCase().includes(lowerQuery))
      .slice(0, limit);
  }

  getAllConcepts(): SemanticNode[] {
    return Array.from(this.nodes.values());
  }

  clear(): void {
    this.nodes.clear();
    this.conceptIndex.clear();
  }
}
