import type { MemoryEntry, MemoryType } from "@paracosm/shared";
import type { MemoryQueryInternal, RankedResult, PaginatedResult, MemoryEvents, MemoryEventName } from "./types.js";

type EventHandler = (data: unknown) => void;

export class MemoryQuery {
  private listeners: Map<string, Set<EventHandler>>;

  constructor() {
    this.listeners = new Map();
  }

  parse(queryString: string): MemoryQueryInternal {
    const query: MemoryQueryInternal = {
      text: "",
      types: [],
      tags: [],
      timeRange: null,
      minImportance: 0,
      limit: 100,
      offset: 0,
      sortBy: "importance",
      sortOrder: "descending",
      filters: [],
    };

    const tokens = this.tokenize(queryString);
    let i = 0;

    while (i < tokens.length) {
      const token = tokens[i];

      if (token === "type:" && i + 1 < tokens.length) {
        i += 1;
        const typeValue = tokens[i] as MemoryType;
        if (!query.types.includes(typeValue)) {
          query.types.push(typeValue);
        }
      } else if (token === "tag:" && i + 1 < tokens.length) {
        i += 1;
        if (!query.tags.includes(tokens[i])) {
          query.tags.push(tokens[i]);
        }
      } else if (token === "importance:" && i + 1 < tokens.length) {
        i += 1;
        const val = parseFloat(tokens[i]);
        if (!isNaN(val)) {
          query.minImportance = val;
        }
      } else if (token === "limit:" && i + 1 < tokens.length) {
        i += 1;
        const val = parseInt(tokens[i], 10);
        if (!isNaN(val) && val > 0) {
          query.limit = val;
        }
      } else if (token === "offset:" && i + 1 < tokens.length) {
        i += 1;
        const val = parseInt(tokens[i], 10);
        if (!isNaN(val) && val >= 0) {
          query.offset = val;
        }
      } else if (token === "sort:" && i + 1 < tokens.length) {
        i += 1;
        query.sortBy = tokens[i];
      } else if (token === "order:" && i + 1 < tokens.length) {
        i += 1;
        query.sortOrder = tokens[i] === "asc" ? "ascending" : "descending";
      } else if (token === "after:" && i + 1 < tokens.length) {
        i += 1;
        if (!query.timeRange) {
          query.timeRange = { start: tokens[i], end: new Date().toISOString() };
        } else {
          query.timeRange.start = tokens[i];
        }
      } else if (token === "before:" && i + 1 < tokens.length) {
        i += 1;
        if (!query.timeRange) {
          query.timeRange = { start: "1970-01-01T00:00:00.000Z", end: tokens[i] };
        } else {
          query.timeRange.end = tokens[i];
        }
      } else if (token.includes(":") && !token.startsWith(":")) {
        const colonIndex = token.indexOf(":");
        const field = token.substring(0, colonIndex);
        const value = token.substring(colonIndex + 1);
        query.filters.push({
          field,
          operator: "eq",
          value,
        });
      } else {
        if (query.text.length > 0) {
          query.text += " ";
        }
        query.text += token;
      }

      i += 1;
    }

    query.text = query.text.trim();
    return query;
  }

  optimize(query: MemoryQueryInternal): MemoryQueryInternal {
    const optimized = { ...query, filters: [...query.filters] };

    if (optimized.limit <= 0) {
      optimized.limit = 100;
    }

    if (optimized.offset < 0) {
      optimized.offset = 0;
    }

    if (optimized.minImportance < 0) {
      optimized.minImportance = 0;
    }
    if (optimized.minImportance > 1) {
      optimized.minImportance = 1;
    }

    if (optimized.text) {
      optimized.text = optimized.text
        .split(/\s+/)
        .filter((t) => t.length > 0)
        .join(" ")
        .trim();
    }

    const seenFilters = new Set<string>();
    optimized.filters = optimized.filters.filter((f) => {
      const key = `${f.field}:${f.operator}:${f.value}`;
      if (seenFilters.has(key)) return false;
      seenFilters.add(key);
      return true;
    });

    if (optimized.timeRange) {
      const start = new Date(optimized.timeRange.start).getTime();
      const end = new Date(optimized.timeRange.end).getTime();
      if (start > end) {
        optimized.timeRange = {
          start: optimized.timeRange.end,
          end: optimized.timeRange.start,
        };
      }
    }

    return optimized;
  }

  execute(query: MemoryQueryInternal, store: Map<string, MemoryEntry>): MemoryEntry[] {
    let results = Array.from(store.values());

    if (query.text) {
      const terms = query.text.toLowerCase().split(/\s+/);
      results = results.filter((entry) => {
        const content = entry.content.toLowerCase();
        return terms.some((term) => content.includes(term));
      });
    }

    if (query.types.length > 0) {
      results = results.filter((entry) => query.types.includes(entry.type));
    }

    if (query.tags.length > 0) {
      results = results.filter((entry) =>
        query.tags.some((tag) => entry.tags.includes(tag))
      );
    }

    if (query.minImportance > 0) {
      results = results.filter((entry) => entry.importance >= query.minImportance);
    }

    if (query.timeRange) {
      const startMs = new Date(query.timeRange.start).getTime();
      const endMs = new Date(query.timeRange.end).getTime();
      results = results.filter((entry) => {
        const createdMs = new Date(entry.createdAt).getTime();
        return createdMs >= startMs && createdMs <= endMs;
      });
    }

    for (const filter of query.filters) {
      results = this.applyFilter(results, filter);
    }

    results = this.sortResults(results, query.sortBy, query.sortOrder);

    return results;
  }

  rank(results: MemoryEntry[], query: MemoryQueryInternal): RankedResult[] {
    const ranked: RankedResult[] = results.map((entry) => {
      let score = 0;
      const reasons: string[] = [];

      if (query.text) {
        const terms = query.text.toLowerCase().split(/\s+/);
        const content = entry.content.toLowerCase();
        let matchCount = 0;
        for (const term of terms) {
          if (content.includes(term)) {
            matchCount += 1;
          }
        }
        const textScore = terms.length > 0 ? matchCount / terms.length : 0;
        score += textScore * 0.4;
        if (matchCount > 0) {
          reasons.push(`text match (${matchCount}/${terms.length} terms)`);
        }
      }

      score += entry.importance * 0.25;
      if (entry.importance > 0.7) {
        reasons.push("high importance");
      }

      const now = Date.now();
      const ageMs = now - new Date(entry.lastAccessedAt).getTime();
      const recencyScore = Math.exp(-ageMs / 86400000);
      score += recencyScore * 0.15;
      if (ageMs < 3600000) {
        reasons.push("recently accessed");
      }

      score += Math.min(entry.accessCount / 10, 1) * 0.1;
      if (entry.accessCount > 5) {
        reasons.push(`frequently accessed (${entry.accessCount} times)`);
      }

      if (query.tags.length > 0) {
        const tagOverlap = entry.tags.filter((t) => query.tags.includes(t)).length;
        score += (tagOverlap / query.tags.length) * 0.1;
        if (tagOverlap > 0) {
          reasons.push(`${tagOverlap} matching tags`);
        }
      }

      return {
        entry,
        score,
        matchReason: reasons.length > 0 ? reasons.join("; ") : "no specific match",
      };
    });

    ranked.sort((a, b) => b.score - a.score);
    return ranked;
  }

  filter(results: MemoryEntry[], criteria: Array<{
    field: string;
    operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
    value: unknown;
  }>): MemoryEntry[] {
    let filtered = results;

    for (const criterion of criteria) {
      filtered = this.applyFilter(filtered, criterion);
    }

    return filtered;
  }

  paginate(results: MemoryEntry[], page: number, size: number): PaginatedResult {
    const total = results.length;
    const offset = (page - 1) * size;
    const paginatedEntries = results.slice(offset, offset + size);
    const hasMore = offset + size < total;

    return {
      entries: paginatedEntries,
      page,
      pageSize: size,
      total,
      hasMore,
    };
  }

  private tokenize(queryString: string): string[] {
    const tokens: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < queryString.length; i++) {
      const char = queryString[i];

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === " " && !inQuotes) {
        if (current.length > 0) {
          tokens.push(current);
          current = "";
        }
      } else {
        current += char;
      }
    }

    if (current.length > 0) {
      tokens.push(current);
    }

    return tokens;
  }

  private applyFilter(
    entries: MemoryEntry[],
    filter: { field: string; operator: string; value: unknown }
  ): MemoryEntry[] {
    return entries.filter((entry) => {
      const fieldValue = this.getEntryField(entry, filter.field);
      return this.evaluateOperator(fieldValue, filter.operator, filter.value);
    });
  }

  private getEntryField(entry: MemoryEntry, field: string): unknown {
    switch (field) {
      case "id": return entry.id;
      case "type": return entry.type;
      case "content": return entry.content;
      case "importance": return entry.importance;
      case "accessCount": return entry.accessCount;
      case "source": return entry.source;
      case "createdAt": return entry.createdAt;
      case "updatedAt": return entry.updatedAt;
      case "lastAccessedAt": return entry.lastAccessedAt;
      case "tags": return entry.tags;
      default: return entry.metadata[field];
    }
  }

  private evaluateOperator(fieldValue: unknown, operator: string, filterValue: unknown): boolean {
    if (fieldValue === undefined || fieldValue === null) return false;

    switch (operator) {
      case "eq": return fieldValue === filterValue;
      case "neq": return fieldValue !== filterValue;
      case "gt": {
        const a = Number(fieldValue);
        const b = Number(filterValue);
        return !isNaN(a) && !isNaN(b) && a > b;
      }
      case "gte": {
        const a = Number(fieldValue);
        const b = Number(filterValue);
        return !isNaN(a) && !isNaN(b) && a >= b;
      }
      case "lt": {
        const a = Number(fieldValue);
        const b = Number(filterValue);
        return !isNaN(a) && !isNaN(b) && a < b;
      }
      case "lte": {
        const a = Number(fieldValue);
        const b = Number(filterValue);
        return !isNaN(a) && !isNaN(b) && a <= b;
      }
      case "in": {
        if (Array.isArray(filterValue)) {
          return filterValue.includes(fieldValue);
        }
        return false;
      }
      case "contains": {
        if (typeof fieldValue === "string" && typeof filterValue === "string") {
          return fieldValue.toLowerCase().includes(filterValue.toLowerCase());
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(filterValue);
        }
        return false;
      }
      default: return false;
    }
  }

  private sortResults(entries: MemoryEntry[], sortBy: string, sortOrder: string): MemoryEntry[] {
    const sorted = [...entries];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "importance":
          comparison = a.importance - b.importance;
          break;
        case "accessCount":
          comparison = a.accessCount - b.accessCount;
          break;
        case "createdAt":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "updatedAt":
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case "lastAccessedAt":
          comparison = new Date(a.lastAccessedAt).getTime() - new Date(b.lastAccessedAt).getTime();
          break;
        case "content":
          comparison = a.content.localeCompare(b.content);
          break;
        default:
          comparison = 0;
      }

      return sortOrder === "ascending" ? comparison : -comparison;
    });

    return sorted;
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
