import { GraphStoreAdapter, type GraphNode, type GraphEdge } from './graph-store-adapter.js';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('SqliteGraphStore');

export class SqliteGraphStore extends GraphStoreAdapter {
  private dbPath: string;
  private initialized: boolean = false;

  constructor(dbPath: string = ':memory:') {
    super();
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    logger.info(`SQLite graph store initialized at: ${this.dbPath}`);
  }

  async addNodeAsync(node: GraphNode): Promise<void> {
    this.addNode(node);
  }

  async removeNodeAsync(id: string): Promise<boolean> {
    return this.removeNode(id);
  }

  async addEdgeAsync(edge: GraphEdge): Promise<void> {
    this.addEdge(edge);
  }

  async removeEdgeAsync(id: string): Promise<boolean> {
    return this.removeEdge(id);
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
