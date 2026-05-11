import type { MemoryGraphNode, MemoryGraphEdge } from "../types.js";

export interface GraphStoreAdapter {
  query(pattern: GraphQueryPattern): MemoryGraphNode[];
  mutate(operation: GraphMutation): void;
  traverse(start: string, depth: number): MemoryGraphNode[];
}

export interface GraphQueryPattern {
  nodeType?: string;
  properties?: Record<string, unknown>;
  labels?: string[];
  limit?: number;
}

export interface GraphMutation {
  type: "addNode" | "removeNode" | "addEdge" | "removeEdge" | "updateNode" | "updateEdge";
  node?: MemoryGraphNode;
  edge?: MemoryGraphEdge;
  nodeId?: string;
  edgeId?: string;
  properties?: Record<string, unknown>;
}

export abstract class BaseGraphStoreAdapter implements GraphStoreAdapter {
  protected nodes: Map<string, MemoryGraphNode>;
  protected edges: Map<string, MemoryGraphEdge>;
  protected adjacency: Map<string, Set<string>>;
  protected reverseAdjacency: Map<string, Set<string>>;

  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.adjacency = new Map();
    this.reverseAdjacency = new Map();
  }

  abstract query(pattern: GraphQueryPattern): MemoryGraphNode[];
  abstract mutate(operation: GraphMutation): void;
  abstract traverse(start: string, depth: number): MemoryGraphNode[];

  protected addNodeInternal(node: MemoryGraphNode): void {
    this.nodes.set(node.id, node);
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, new Set());
    }
    if (!this.reverseAdjacency.has(node.id)) {
      this.reverseAdjacency.set(node.id, new Set());
    }
  }

  protected removeNodeInternal(nodeId: string): void {
    this.nodes.delete(nodeId);

    const outgoing = this.adjacency.get(nodeId);
    if (outgoing) {
      for (const edgeId of outgoing) {
        const edge = this.edges.get(edgeId);
        if (edge) {
          const reverseEdges = this.reverseAdjacency.get(edge.targetId);
          if (reverseEdges) {
            reverseEdges.delete(edgeId);
          }
        }
        this.edges.delete(edgeId);
      }
      this.adjacency.delete(nodeId);
    }

    const incoming = this.reverseAdjacency.get(nodeId);
    if (incoming) {
      for (const edgeId of incoming) {
        const edge = this.edges.get(edgeId);
        if (edge) {
          const sourceEdges = this.adjacency.get(edge.sourceId);
          if (sourceEdges) {
            sourceEdges.delete(edgeId);
          }
        }
        this.edges.delete(edgeId);
      }
      this.reverseAdjacency.delete(nodeId);
    }
  }

  protected addEdgeInternal(edge: MemoryGraphEdge): void {
    this.edges.set(edge.id, edge);

    if (!this.adjacency.has(edge.sourceId)) {
      this.adjacency.set(edge.sourceId, new Set());
    }
    this.adjacency.get(edge.sourceId)!.add(edge.id);

    if (!this.reverseAdjacency.has(edge.targetId)) {
      this.reverseAdjacency.set(edge.targetId, new Set());
    }
    this.reverseAdjacency.get(edge.targetId)!.add(edge.id);
  }

  protected removeEdgeInternal(edgeId: string): void {
    const edge = this.edges.get(edgeId);
    if (!edge) return;

    const sourceEdges = this.adjacency.get(edge.sourceId);
    if (sourceEdges) {
      sourceEdges.delete(edgeId);
    }

    const targetEdges = this.reverseAdjacency.get(edge.targetId);
    if (targetEdges) {
      targetEdges.delete(edgeId);
    }

    this.edges.delete(edgeId);
  }

  getNode(id: string): MemoryGraphNode | null {
    return this.nodes.get(id) ?? null;
  }

  getEdge(id: string): MemoryGraphEdge | null {
    return this.edges.get(id) ?? null;
  }

  getOutgoingEdges(nodeId: string): MemoryGraphEdge[] {
    const edgeIds = this.adjacency.get(nodeId);
    if (!edgeIds) return [];
    return Array.from(edgeIds)
      .map((id) => this.edges.get(id))
      .filter((e): e is MemoryGraphEdge => e !== undefined);
  }

  getIncomingEdges(nodeId: string): MemoryGraphEdge[] {
    const edgeIds = this.reverseAdjacency.get(nodeId);
    if (!edgeIds) return [];
    return Array.from(edgeIds)
      .map((id) => this.edges.get(id))
      .filter((e): e is MemoryGraphEdge => e !== undefined);
  }

  nodeCount(): number {
    return this.nodes.size;
  }

  edgeCount(): number {
    return this.edges.size;
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  hasEdge(id: string): boolean {
    return this.edges.has(id);
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.adjacency.clear();
    this.reverseAdjacency.clear();
  }
}
