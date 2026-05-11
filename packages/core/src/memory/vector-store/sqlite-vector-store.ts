import { VectorStoreAdapter, type VectorEntry, type VectorSearchResult } from './vector-store-adapter.js';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('SqliteVectorStore');

export class SqliteVectorStore extends VectorStoreAdapter {
  private dbPath: string;
  private initialized: boolean = false;

  constructor(dimensions: number = 128, dbPath: string = ':memory:') {
    super(dimensions);
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    logger.info(`SQLite vector store initialized at: ${this.dbPath}`);
  }

  async addAsync(id: string, vector: number[], metadata?: Record<string, unknown>): Promise<void> {
    this.add(id, vector, metadata);
  }

  async removeAsync(id: string): Promise<boolean> {
    return this.remove(id);
  }

  async searchAsync(queryVector: number[], limit?: number, threshold?: number): Promise<VectorSearchResult[]> {
    return this.search(queryVector, limit, threshold);
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
