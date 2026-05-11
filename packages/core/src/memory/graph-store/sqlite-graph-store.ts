import { BaseGraphStoreAdapter } from "./graph-store-adapter.js";
import type { GraphQueryPattern, GraphMutation } from "./graph-store-adapter.js";
import type { MemoryGraphNode, MemoryGraphEdge } from "../types.js";
import { generateId } from "@paracosm/shared";

export class SQLiteGraphStore extends BaseGraphStoreAdapter {
  private filePath: string | null;
  private dirty: boolean;
  private lastSavedAt: number;
  private labelIndex: Map<string, Set<string>>;
  private typeIndex: Map<string, Set<string>>;
  private edgeTypeIndex: Map<string, Set<string>>;

  constructor(filePath: string | null = null) {
    super();
    this.filePath = filePath;
    this.dirty = false;
    this.lastSavedAt = 0;
    this.labelIndex = new Map();
    this.typeIndex = new Map();
    this.edgeTypeIndex = new Map();
  }

  query(pattern: GraphQueryPattern): MemoryGraphNode[] {
    let results = Array.from(this.nodes.values());

    if (pattern.nodeType) {
      const typeIds = this.typeIndex.get(pattern.nodeType);
      if (typeIds) {
        results = results.filter((n) => typeIds.has(n.id));
      } else {
        results = [];
      }
    }

    if (pattern.labels && pattern.labels.length > 0) {
      results = results.filter((node) =>
        pattern.labels!.some((label) => node.labels.includes(label))
      );
    }

    if (pattern.properties) {
      results = results.filter((node) => {
        for (const [key, value] of Object.entries(pattern.properties!)) {
          if (node.properties[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    if (pattern.limit !== undefined) {
      results = results.slice(0, pattern.limit);
    }

    return results;
  }

  mutate(operation: GraphMutation): void {
    switch (operation.type) {
      case "addNode":
        if (operation.node) {
          this.addNodeInternal(operation.node);
          this.indexNode(operation.node);
        }
        break;
      case "removeNode":
        if (operation.nodeId) {
          this.deindexNode(operation.nodeId);
          this.removeNodeInternal(operation.nodeId);
        }
        break;
      case "addEdge":
        if (operation.edge) {
          this.addEdgeInternal(operation.edge);
          this.indexEdge(operation.edge);
        }
        break;
      case "removeEdge":
        if (operation.edgeId) {
          this.deindexEdge(operation.edgeId);
          this.removeEdgeInternal(operation.edgeId);
        }
        break;
      case "updateNode":
        if (operation.nodeId && operation.properties) {
          const node = this.nodes.get(operation.nodeId);
          if (node) {
            node.properties = { ...node.properties, ...operation.properties };
            node.updatedAt = new Date().toISOString();
          }
        }
        break;
      case "updateEdge":
        if (operation.edgeId && operation.properties) {
          const edge = this.edges.get(operation.edgeId);
          if (edge) {
            edge.properties = { ...edge.properties, ...operation.properties };
          }
        }
        break;
    }

    this.dirty = true;
  }

  traverse(start: string, depth: number): MemoryGraphNode[] {
    const startNode = this.nodes.get(start);
    if (!startNode || depth <= 0) {
      return startNode ? [startNode] : [];
    }

    const visited = new Set<string>();
    const result: MemoryGraphNode[] = [];
    const queue: Array<{ nodeId: string; currentDepth: number }> = [{ nodeId: start, currentDepth: 0 }];

    while (queue.length > 0) {
      const { nodeId, currentDepth } = queue.shift()!;

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (node) {
        result.push(node);
      }

      if (currentDepth >= depth) continue;

      const outgoing = this.getOutgoingEdges(nodeId);
      for (const edge of outgoing) {
        if (!visited.has(edge.targetId)) {
          queue.push({ nodeId: edge.targetId, currentDepth: currentDepth + 1 });
        }
      }

      const incoming = this.getIncomingEdges(nodeId);
      for (const edge of incoming) {
        if (!visited.has(edge.sourceId)) {
          queue.push({ nodeId: edge.sourceId, currentDepth: currentDepth + 1 });
        }
      }
    }

    return result;
  }

  traverseDFS(start: string, depth: number): MemoryGraphNode[] {
    const startNode = this.nodes.get(start);
    if (!startNode) return [];

    const visited = new Set<string>();
    const result: MemoryGraphNode[] = [];

    const dfs = (nodeId: string, currentDepth: number): void => {
      if (visited.has(nodeId) || currentDepth > depth) return;
      visited.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (node) {
        result.push(node);
      }

      const outgoing = this.getOutgoingEdges(nodeId);
      for (const edge of outgoing) {
        dfs(edge.targetId, currentDepth + 1);
      }
    };

    dfs(start, 0);
    return result;
  }

  findPath(startId: string, endId: string, maxDepth: number = 10): MemoryGraphNode[] {
    if (!this.nodes.has(startId) || !this.nodes.has(endId)) return [];

    const visited = new Set<string>();
    const parent = new Map<string, string | null>();
    const queue: string[] = [startId];
    visited.add(startId);
    parent.set(startId, null);

    let found = false;
    let depth = 0;

    while (queue.length > 0 && !found && depth < maxDepth) {
      const levelSize = queue.length;
      depth += 1;

      for (let i = 0; i < levelSize && !found; i++) {
        const current = queue.shift()!;

        const outgoing = this.getOutgoingEdges(current);
        for (const edge of outgoing) {
          if (visited.has(edge.targetId)) continue;
          visited.add(edge.targetId);
          parent.set(edge.targetId, current);

          if (edge.targetId === endId) {
            found = true;
            break;
          }

          queue.push(edge.targetId);
        }

        if (found) break;

        const incoming = this.getIncomingEdges(current);
        for (const edge of incoming) {
          if (visited.has(edge.sourceId)) continue;
          visited.add(edge.sourceId);
          parent.set(edge.sourceId, current);

          if (edge.sourceId === endId) {
            found = true;
            break;
          }

          queue.push(edge.sourceId);
        }
      }
    }

    if (!found) return [];

    const path: string[] = [];
    let current: string | null | undefined = endId;
    while (current !== null && current !== undefined) {
      path.unshift(current);
      current = parent.get(current);
    }

    return path
      .map((id) => this.nodes.get(id))
      .filter((n): n is MemoryGraphNode => n !== undefined);
  }

  addNode(type: string, properties: Record<string, unknown> = {}, labels: string[] = []): MemoryGraphNode {
    const now = new Date().toISOString();
    const node: MemoryGraphNode = {
      id: generateId(),
      type,
      properties,
      labels,
      createdAt: now,
      updatedAt: now,
    };

    this.mutate({ type: "addNode", node });
    return node;
  }

  addEdge(sourceId: string, targetId: string, type: string, weight: number = 1, properties: Record<string, unknown> = {}): MemoryGraphEdge | null {
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) return null;

    const edge: MemoryGraphEdge = {
      id: generateId(),
      sourceId,
      targetId,
      type,
      properties,
      weight,
      createdAt: new Date().toISOString(),
    };

    this.mutate({ type: "addEdge", edge });
    return edge;
  }

  getNeighbors(nodeId: string, direction: "outgoing" | "incoming" | "both" = "both"): MemoryGraphNode[] {
    const neighborIds = new Set<string>();

    if (direction === "outgoing" || direction === "both") {
      for (const edge of this.getOutgoingEdges(nodeId)) {
        neighborIds.add(edge.targetId);
      }
    }

    if (direction === "incoming" || direction === "both") {
      for (const edge of this.getIncomingEdges(nodeId)) {
        neighborIds.add(edge.sourceId);
      }
    }

    return Array.from(neighborIds)
      .map((id) => this.nodes.get(id))
      .filter((n): n is MemoryGraphNode => n !== undefined);
  }

  getEdgesBetween(sourceId: string, targetId: string): MemoryGraphEdge[] {
    const outgoing = this.getOutgoingEdges(sourceId);
    return outgoing.filter((e) => e.targetId === targetId);
  }

  async saveToDisk(): Promise<void> {
    if (!this.filePath) return;

    const { writeFile, mkdir } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    const { existsSync } = await import("node:fs");

    const data = {
      nodes: Array.from(this.nodes.entries()),
      edges: Array.from(this.edges.entries()),
    };

    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(this.filePath, JSON.stringify(data), "utf8");
    this.dirty = false;
    this.lastSavedAt = Date.now();
  }

  async loadFromDisk(): Promise<void> {
    if (!this.filePath) return;

    const { readFile } = await import("node:fs/promises");
    const { existsSync } = await import("node:fs");

    if (!existsSync(this.filePath)) return;

    const data = await readFile(this.filePath, "utf8");
    const parsed = JSON.parse(data);

    this.clear();
    this.labelIndex.clear();
    this.typeIndex.clear();
    this.edgeTypeIndex.clear();

    for (const [id, node] of parsed.nodes) {
      this.nodes.set(id, node);
      this.indexNode(node);
      this.adjacency.set(id, new Set());
      this.reverseAdjacency.set(id, new Set());
    }

    for (const [id, edge] of parsed.edges) {
      this.edges.set(id, edge);
      this.indexEdge(edge);

      if (!this.adjacency.has(edge.sourceId)) {
        this.adjacency.set(edge.sourceId, new Set());
      }
      this.adjacency.get(edge.sourceId)!.add(id);

      if (!this.reverseAdjacency.has(edge.targetId)) {
        this.reverseAdjacency.set(edge.targetId, new Set());
      }
      this.reverseAdjacency.get(edge.targetId)!.add(id);
    }

    this.dirty = false;
  }

  isDirty(): boolean {
    return this.dirty;
  }

  getLastSavedAt(): number {
    return this.lastSavedAt;
  }

  getNodesByType(type: string): MemoryGraphNode[] {
    const ids = this.typeIndex.get(type);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.nodes.get(id))
      .filter((n): n is MemoryGraphNode => n !== undefined);
  }

  getNodesByLabel(label: string): MemoryGraphNode[] {
    const ids = this.labelIndex.get(label);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.nodes.get(id))
      .filter((n): n is MemoryGraphNode => n !== undefined);
  }

  getEdgesByType(type: string): MemoryGraphEdge[] {
    const ids = this.edgeTypeIndex.get(type);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.edges.get(id))
      .filter((e): e is MemoryGraphEdge => e !== undefined);
  }

  private indexNode(node: MemoryGraphNode): void {
    if (!this.typeIndex.has(node.type)) {
      this.typeIndex.set(node.type, new Set());
    }
    this.typeIndex.get(node.type)!.add(node.id);

    for (const label of node.labels) {
      if (!this.labelIndex.has(label)) {
        this.labelIndex.set(label, new Set());
      }
      this.labelIndex.get(label)!.add(node.id);
    }
  }

  private deindexNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    const typeIds = this.typeIndex.get(node.type);
    if (typeIds) {
      typeIds.delete(nodeId);
      if (typeIds.size === 0) {
        this.typeIndex.delete(node.type);
      }
    }

    for (const label of node.labels) {
      const labelIds = this.labelIndex.get(label);
      if (labelIds) {
        labelIds.delete(nodeId);
        if (labelIds.size === 0) {
          this.labelIndex.delete(label);
        }
      }
    }
  }

  private indexEdge(edge: MemoryGraphEdge): void {
    if (!this.edgeTypeIndex.has(edge.type)) {
      this.edgeTypeIndex.set(edge.type, new Set());
    }
    this.edgeTypeIndex.get(edge.type)!.add(edge.id);
  }

  private deindexEdge(edgeId: string): void {
    const edge = this.edges.get(edgeId);
    if (!edge) return;

    const typeIds = this.edgeTypeIndex.get(edge.type);
    if (typeIds) {
      typeIds.delete(edgeId);
      if (typeIds.size === 0) {
        this.edgeTypeIndex.delete(edge.type);
      }
    }
  }
}
