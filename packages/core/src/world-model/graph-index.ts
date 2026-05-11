import type { Entity, Relation, EntityType, RelationType } from '@paracosm/shared';
import { EntityGraph } from './entity-graph.js';

export interface IndexEntry {
  entityId: string;
  tokens: string[];
  type: EntityType;
  updatedAt: Date;
}

export class GraphIndex {
  private graph: EntityGraph;
  private nameIndex: Map<string, Set<string>> = new Map();
  private attributeIndex: Map<string, Map<string, Set<string>>> = new Map();
  private fullTextIndex: Map<string, Set<string>> = new Map();
  private typeIndex: Map<EntityType, Set<string>> = new Map();
  private dirty: boolean = true;

  constructor(graph: EntityGraph) {
    this.graph = graph;
    this.graph.on((event) => {
      if (event.startsWith('entity:') || event.startsWith('graph:')) {
        this.dirty = true;
      }
    });
  }

  private rebuildIfNeeded(): void {
    if (!this.dirty) return;
    this.nameIndex.clear();
    this.attributeIndex.clear();
    this.fullTextIndex.clear();
    this.typeIndex.clear();
    for (const [id, entity] of this.graph.getAllEntities()) {
      this.indexEntity(id, entity);
    }
    this.dirty = false;
  }

  private indexEntity(id: string, entity: Entity): void {
    const nameTokens = entity.name.toLowerCase().split(/[\s_-]+/);
    for (const token of nameTokens) {
      const set = this.nameIndex.get(token) ?? new Set();
      set.add(id);
      this.nameIndex.set(token, set);
    }
    const typeSet = this.typeIndex.get(entity.type) ?? new Set();
    typeSet.add(id);
    this.typeIndex.set(entity.type, typeSet);
    const allText = `${entity.name} ${entity.description}`.toLowerCase();
    const textTokens = allText.split(/[\s_-]+/).filter((t) => t.length > 2);
    for (const token of textTokens) {
      const set = this.fullTextIndex.get(token) ?? new Set();
      set.add(id);
      this.fullTextIndex.set(token, set);
    }
    for (const [key, value] of Object.entries(entity.attributes)) {
      const attrMap = this.attributeIndex.get(key) ?? new Map();
      const valueKey = String(value).toLowerCase();
      const set = attrMap.get(valueKey) ?? new Set();
      set.add(id);
      attrMap.set(valueKey, set);
      this.attributeIndex.set(key, attrMap);
    }
  }

  searchByName(name: string): string[] {
    this.rebuildIfNeeded();
    const tokens = name.toLowerCase().split(/[\s_-]+/);
    if (tokens.length === 0) return [];
    let result = this.nameIndex.get(tokens[0]) ?? new Set();
    for (let i = 1; i < tokens.length; i++) {
      const tokenSet = this.nameIndex.get(tokens[i]) ?? new Set();
      result = new Set([...result].filter((id) => tokenSet.has(id)));
    }
    return Array.from(result);
  }

  searchByAttribute(key: string, value: unknown): string[] {
    this.rebuildIfNeeded();
    const attrMap = this.attributeIndex.get(key);
    if (!attrMap) return [];
    const valueKey = String(value).toLowerCase();
    const set = attrMap.get(valueKey);
    return set ? Array.from(set) : [];
  }

  searchFullText(query: string): string[] {
    this.rebuildIfNeeded();
    const tokens = query.toLowerCase().split(/[\s_-]+/).filter((t) => t.length > 2);
    if (tokens.length === 0) return [];
    const allResults: Map<string, number> = new Map();
    for (const token of tokens) {
      for (const [indexToken, ids] of this.fullTextIndex) {
        if (indexToken.includes(token) || token.includes(indexToken)) {
          for (const id of ids) {
            allResults.set(id, (allResults.get(id) ?? 0) + 1);
          }
        }
      }
    }
    return Array.from(allResults.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
  }

  searchByType(type: EntityType): string[] {
    this.rebuildIfNeeded();
    const set = this.typeIndex.get(type);
    return set ? Array.from(set) : [];
  }

  getStats(): { nameTokens: number; attributeKeys: number; fullTextTokens: number; typeEntries: number } {
    this.rebuildIfNeeded();
    return {
      nameTokens: this.nameIndex.size,
      attributeKeys: this.attributeIndex.size,
      fullTextTokens: this.fullTextIndex.size,
      typeEntries: this.typeIndex.size,
    };
  }

  invalidate(): void {
    this.dirty = true;
  }
}
