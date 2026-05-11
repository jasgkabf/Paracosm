import { createLogger } from '@paracosm/shared';

const logger = createLogger('GraphStoreAdapter');

export interface GraphNode {
  id: string;
  label: string;
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  properties: Record<string, unknown>;
}

export interface GraphTraversalResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export class GraphStoreAdapter {
  protected nodes: Map<string, GraphNode> = new Map();
  protected edges: Map<string, GraphEdge> = new Map();
  protected adjacency: Map<string, string[]> = new Map();

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, []);
    }
  }

  removeNode(id: string): boolean {
    if (!this.nodes.has(id)) return false;
    this.nodes.delete(id);
    this.adjacency.delete(id);
    const edgesToRemove: string[] = [];
    for (const [edgeId, edge] of this.edges) {
      if (edge.sourceId === id || edge.targetId === id) {
        edgesToRemove.push(edgeId);
      }
    }
    for (const edgeId of edgesToRemove) {
      this.edges.delete(edgeId);
    }
    return true;
  }

  addEdge(edge: GraphEdge): void {
    this.edges.set(edge.id, edge);
    const sourceAdj = this.adjacency.get(edge.sourceId) ?? [];
    sourceAdj.push(edge.targetId);
    this.adjacency.set(edge.sourceId, sourceAdj);
  }

  removeEdge(id: string): boolean {
    const edge = this.edges.get(id);
    if (!edge) return false;
    this.edges.delete(id);
    const sourceAdj = this.adjacency.get(edge.sourceId);
    if (sourceAdj) {
      const idx = sourceAdj.indexOf(edge.targetId);
      if (idx !== -1) sourceAdj.splice(idx, 1);
    }
    return true;
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getEdge(id: string): GraphEdge | undefined {
    return this.edges.get(id);
  }

  getNeighbors(nodeId: string): GraphNode[] {
    const neighborIds = this.adjacency.get(nodeId) ?? [];
    return neighborIds
      .map((id) => this.nodes.get(id))
      .filter((n): n is GraphNode => n !== undefined);
  }

  traverse(startId: string, maxDepth: number = 10): GraphTraversalResult {
    const visited = new Set<string>();
    const resultNodes: GraphNode[] = [];
    const resultEdges: GraphEdge[] = [];
    const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
    visited.add(startId);
    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (depth > maxDepth) continue;
      const node = this.nodes.get(id);
      if (node) resultNodes.push(node);
      if (depth === maxDepth) continue;
      const neighbors = this.adjacency.get(id) ?? [];
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({ id: neighborId, depth: depth + 1 });
        }
      }
    }
    for (const edge of this.edges.values()) {
      if (visited.has(edge.sourceId) && visited.has(edge.targetId)) {
        resultEdges.push(edge);
      }
    }
    return { nodes: resultNodes, edges: resultEdges };
  }

  nodeCount(): number {
    return this.nodes.size;
  }

  edgeCount(): number {
    return this.edges.size;
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.adjacency.clear();
  }
}
