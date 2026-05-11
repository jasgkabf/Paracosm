import type { MemoryEntry, MemoryType } from '@paracosm/shared';
import { generateId, ok, err, type Result, createLogger } from '@paracosm/shared';

const logger = createLogger('WorkingMemory');

export class WorkingMemory {
  private entries: Map<string, MemoryEntry> = new Map();
  private capacity: number;
  private order: string[] = [];

  constructor(capacity: number = 10) {
    this.capacity = capacity;
  }

  store(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'accessCount'> & { id?: string }): Result<MemoryEntry> {
    const id = entry.id ?? generateId();
    const now = new Date();
    const newEntry: MemoryEntry = {
      ...entry,
      id,
      createdAt: now,
      accessCount: 0,
    };
    if (this.entries.size >= this.capacity) {
      const oldestId = this.order.shift();
      if (oldestId) this.entries.delete(oldestId);
    }
    this.entries.set(id, newEntry);
    this.order.push(id);
    return ok(newEntry);
  }

  retrieve(id: string): MemoryEntry | undefined {
    const entry = this.entries.get(id);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessedAt = new Date();
    }
    return entry;
  }

  remove(id: string): Result<boolean> {
    if (!this.entries.has(id)) return err(new Error(`Entry ${id} not found`));
    this.entries.delete(id);
    this.order = this.order.filter((oid) => oid !== id);
    return ok(true);
  }

  getAll(): MemoryEntry[] {
    return this.order.map((id) => this.entries.get(id)).filter((e): e is MemoryEntry => e !== undefined);
  }

  clear(): void {
    this.entries.clear();
    this.order = [];
  }

  getSize(): number {
    return this.entries.size;
  }

  getCapacity(): number {
    return this.capacity;
  }

  isFull(): boolean {
    return this.entries.size >= this.capacity;
  }

  getLeastRecentlyUsed(): MemoryEntry | undefined {
    if (this.order.length === 0) return undefined;
    return this.entries.get(this.order[0]);
  }

  evict(count: number = 1): MemoryEntry[] {
    const evicted: MemoryEntry[] = [];
    for (let i = 0; i < count && this.order.length > 0; i++) {
      const id = this.order.shift()!;
      const entry = this.entries.get(id);
      if (entry) {
        evicted.push(entry);
        this.entries.delete(id);
      }
    }
    return evicted;
  }
}
