import type { WorkingMemoryEntry, EvictionPolicy, MemoryEvents, MemoryEventName } from "./types.js";
import { MemoryError } from "@paracosm/shared";

type EventHandler = (data: unknown) => void;

export class WorkingMemory {
  private store: Map<string, WorkingMemoryEntry>;
  private maxCapacity: number;
  private listeners: Map<string, Set<EventHandler>>;

  constructor(capacity: number = 100) {
    this.store = new Map();
    this.maxCapacity = capacity;
    this.listeners = new Map();
  }

  set(key: string, value: unknown, priority: number = 0.5): void {
    const now = new Date().toISOString();
    const existing = this.store.get(key);

    if (existing) {
      existing.value = value;
      existing.priority = priority;
      existing.updatedAt = now;
      existing.accessCount += 1;
      existing.lastAccessedAt = now;
      return;
    }

    if (this.store.size >= this.maxCapacity) {
      this.eviction("lru");
    }

    const entry: WorkingMemoryEntry = {
      key,
      value,
      priority,
      accessCount: 1,
      lastAccessedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.store.set(key, entry);
    this.emit("memory:stored", { entryId: key, tier: "working" as const });
  }

  get(key: string): unknown {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    entry.accessCount += 1;
    entry.lastAccessedAt = new Date().toISOString();
    this.emit("memory:retrieved", { entryId: key, tier: "working" as const });

    return entry.value;
  }

  update(key: string, value: unknown): void {
    const entry = this.store.get(key);
    if (!entry) {
      throw new MemoryError(`Working memory key not found: ${key}`, {
        key,
        operation: "update",
      });
    }

    entry.value = value;
    entry.updatedAt = new Date().toISOString();
    entry.accessCount += 1;
    entry.lastAccessedAt = new Date().toISOString();
  }

  delete(key: string): void {
    const deleted = this.store.delete(key);
    if (deleted) {
      this.emit("memory:deleted", { entryId: key, tier: "working" as const });
    }
  }

  capacity(): number {
    return this.maxCapacity;
  }

  eviction(policy: EvictionPolicy): void {
    if (this.store.size === 0) {
      return;
    }

    let victimKey: string | null = null;

    if (policy === "lru") {
      let oldestAccess = Infinity;
      for (const [key, entry] of this.store) {
        const accessTime = new Date(entry.lastAccessedAt).getTime();
        if (accessTime < oldestAccess) {
          oldestAccess = accessTime;
          victimKey = key;
        }
      }
    } else if (policy === "lfu") {
      let lowestFreq = Infinity;
      let lowestPriority = Infinity;
      for (const [key, entry] of this.store) {
        if (entry.accessCount < lowestFreq) {
          lowestFreq = entry.accessCount;
          lowestPriority = entry.priority;
          victimKey = key;
        } else if (entry.accessCount === lowestFreq && entry.priority < lowestPriority) {
          lowestPriority = entry.priority;
          victimKey = key;
        }
      }
    }

    if (victimKey !== null) {
      this.store.delete(victimKey);
      this.emit("memory:evicted", { entryId: victimKey, reason: policy });
    }
  }

  clear(): void {
    const keys = Array.from(this.store.keys());
    this.store.clear();
    for (const key of keys) {
      this.emit("memory:deleted", { entryId: key, tier: "working" as const });
    }
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  size(): number {
    return this.store.size;
  }

  entries(): WorkingMemoryEntry[] {
    return Array.from(this.store.values());
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }

  setCapacity(newCapacity: number): void {
    if (newCapacity < 1) {
      throw new MemoryError("Capacity must be at least 1", {
        capacity: newCapacity,
        operation: "setCapacity",
      });
    }

    this.maxCapacity = newCapacity;

    while (this.store.size > this.maxCapacity) {
      this.eviction("lru");
    }
  }

  getEntry(key: string): WorkingMemoryEntry | undefined {
    return this.store.get(key);
  }

  prioritize(key: string, priority: number): void {
    const entry = this.store.get(key);
    if (!entry) {
      throw new MemoryError(`Working memory key not found: ${key}`, {
        key,
        operation: "prioritize",
      });
    }

    const clamped = Math.max(0, Math.min(1, priority));
    entry.priority = clamped;
    entry.updatedAt = new Date().toISOString();
  }

  bulkSet(items: Array<{ key: string; value: unknown; priority?: number }>): void {
    for (const item of items) {
      this.set(item.key, item.value, item.priority);
    }
  }

  bulkDelete(keys: string[]): void {
    for (const key of keys) {
      this.delete(key);
    }
  }

  snapshot(): Map<string, WorkingMemoryEntry> {
    const copy = new Map<string, WorkingMemoryEntry>();
    for (const [key, entry] of this.store) {
      copy.set(key, { ...entry });
    }
    return copy;
  }

  restore(snapshot: Map<string, WorkingMemoryEntry>): void {
    this.store.clear();
    for (const [key, entry] of snapshot) {
      this.store.set(key, { ...entry });
    }
  }

  stats(): {
    size: number;
    capacity: number;
    utilization: number;
    averageAccessCount: number;
    averagePriority: number;
    oldestEntry: string | null;
    newestEntry: string | null;
  } {
    const entries = this.entries();
    const totalAccess = entries.reduce((sum, e) => sum + e.accessCount, 0);
    const totalPriority = entries.reduce((sum, e) => sum + e.priority, 0);

    let oldestTime = Infinity;
    let newestTime = -Infinity;
    let oldestKey: string | null = null;
    let newestKey: string | null = null;

    for (const entry of entries) {
      const created = new Date(entry.createdAt).getTime();
      if (created < oldestTime) {
        oldestTime = created;
        oldestKey = entry.key;
      }
      if (created > newestTime) {
        newestTime = created;
        newestKey = entry.key;
      }
    }

    return {
      size: this.store.size,
      capacity: this.maxCapacity,
      utilization: this.store.size / this.maxCapacity,
      averageAccessCount: entries.length > 0 ? totalAccess / entries.length : 0,
      averagePriority: entries.length > 0 ? totalPriority / entries.length : 0,
      oldestEntry: oldestKey,
      newestEntry: newestKey,
    };
  }

  private emit(event: MemoryEventName, data: unknown): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch {
          continue;
        }
      }
    }
  }

  on(event: MemoryEventName, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: MemoryEventName, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }
}
