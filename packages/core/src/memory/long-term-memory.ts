import type { MemoryEntry, MemoryType } from '@paracosm/shared';
import { generateId, ok, err, type Result, createLogger } from '@paracosm/shared';

const logger = createLogger('LongTermMemory');

export class LongTermMemory {
  private entries: Map<string, MemoryEntry> = new Map();
  private keyIndex: Map<string, string> = new Map();
  private typeIndex: Map<string, Set<string>> = new Map();
  private capacity: number;

  constructor(capacity: number = 10000) {
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
      const leastImportant = this.findLeastImportant();
      if (leastImportant) {
        this.remove(leastImportant.id);
      }
    }
    this.entries.set(id, newEntry);
    this.keyIndex.set(newEntry.id, id);
    const typeSet = this.typeIndex.get(newEntry.type) ?? new Set();
    typeSet.add(id);
    this.typeIndex.set(newEntry.type, typeSet);
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

  retrieveByKey(key: string): MemoryEntry | undefined {
    const id = this.keyIndex.get(key);
    if (!id) return undefined;
    return this.retrieve(id);
  }

  remove(id: string): Result<boolean> {
    const entry = this.entries.get(id);
    if (!entry) return err(new Error(`Entry ${id} not found`));
    this.entries.delete(id);
    this.keyIndex.delete(entry.id);
    const typeSet = this.typeIndex.get(entry.type);
    if (typeSet) {
      typeSet.delete(id);
      if (typeSet.size === 0) this.typeIndex.delete(entry.type);
    }
    return ok(true);
  }

  search(query: string, limit: number = 10): MemoryEntry[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.entries.values())
      .filter((e) => e.content.toLowerCase().includes(lowerQuery) || e.id.toLowerCase().includes(lowerQuery))
      .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
      .slice(0, limit);
  }

  getByType(type: string): MemoryEntry[] {
    const ids = this.typeIndex.get(type);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.entries.get(id))
      .filter((e): e is MemoryEntry => e !== undefined);
  }

  getAll(): MemoryEntry[] {
    return Array.from(this.entries.values());
  }

  private findLeastImportant(): MemoryEntry | null {
    let least: MemoryEntry | null = null;
    for (const entry of this.entries.values()) {
      if (!least || (entry.importance ?? 0) < (least.importance ?? 0)) {
        least = entry;
      }
    }
    return least;
  }

  getSize(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
    this.keyIndex.clear();
    this.typeIndex.clear();
  }
}
