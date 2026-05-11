import type { StrategyGene, GeneId } from '@paracosm/shared';
import { generateId } from '@paracosm/shared';

export function createGene(data: { name: string; type: string; value: unknown; fitness?: number; parentIds?: GeneId[]; metadata?: Record<string, unknown> }): StrategyGene {
  return {
    id: generateId(),
    name: data.name,
    type: data.type,
    value: data.value,
    fitness: data.fitness ?? 0,
    generation: 0,
    parentIds: data.parentIds ?? [],
    mutationCount: 0,
    metadata: data.metadata ?? {},
    createdAt: new Date(),
  };
}

export function cloneGene(gene: StrategyGene, overrides?: Partial<Omit<StrategyGene, 'id' | 'createdAt'>>): StrategyGene {
  return {
    ...gene,
    id: generateId(),
    parentIds: [gene.id],
    mutationCount: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

export function mutateGeneValue(value: unknown, operator: 'gaussian' | 'uniform' | 'bitflip' | 'swap' | 'insert' | 'delete' | 'crossover_point', strength: number = 0.1): unknown {
  if (typeof value === 'number') {
    switch (operator) {
      case 'gaussian':
        return value + (Math.random() - 0.5) * 2 * strength * Math.abs(value || 1);
      case 'uniform':
        return value + (Math.random() - 0.5) * strength * 2;
      default:
        return value + (Math.random() - 0.5) * strength;
    }
  }
  if (typeof value === 'boolean') {
    if (operator === 'bitflip' || Math.random() < strength) {
      return !value;
    }
    return value;
  }
  if (typeof value === 'string') {
    switch (operator) {
      case 'swap': {
        if (value.length < 2) return value;
        const arr = value.split('');
        const i = Math.floor(Math.random() * arr.length);
        const j = Math.floor(Math.random() * arr.length);
        [arr[i], arr[j]] = [arr[j], arr[i]];
        return arr.join('');
      }
      case 'insert': {
        const pos = Math.floor(Math.random() * value.length);
        const char = String.fromCharCode(97 + Math.floor(Math.random() * 26));
        return value.slice(0, pos) + char + value.slice(pos);
      }
      case 'delete': {
        if (value.length < 2) return value;
        const delPos = Math.floor(Math.random() * value.length);
        return value.slice(0, delPos) + value.slice(delPos + 1);
      }
      default:
        return value;
    }
  }
  if (Array.isArray(value)) {
    const arr = [...value];
    if (arr.length === 0) return arr;
    switch (operator) {
      case 'swap': {
        const i = Math.floor(Math.random() * arr.length);
        const j = Math.floor(Math.random() * arr.length);
        [arr[i], arr[j]] = [arr[j], arr[i]];
        return arr;
      }
      case 'insert': {
        const pos = Math.floor(Math.random() * arr.length);
        arr.splice(pos, 0, arr[Math.floor(Math.random() * arr.length)]);
        return arr;
      }
      case 'delete': {
        const delPos = Math.floor(Math.random() * arr.length);
        arr.splice(delPos, 1);
        return arr;
      }
      default:
        return arr.map((v) => mutateGeneValue(v, operator, strength));
    }
  }
  if (typeof value === 'object' && value !== null) {
    const obj = { ...value as Record<string, unknown> };
    const keys = Object.keys(obj);
    if (keys.length > 0) {
      const key = keys[Math.floor(Math.random() * keys.length)];
      obj[key] = mutateGeneValue(obj[key], operator, strength);
    }
    return obj;
  }
  return value;
}

export function crossoverValues(a: unknown, b: unknown, type: 'single_point' | 'two_point' | 'uniform' | 'blend' = 'uniform'): [unknown, unknown] {
  if (typeof a === 'number' && typeof b === 'number') {
    switch (type) {
      case 'blend': {
        const alpha = Math.random();
        const child1 = alpha * a + (1 - alpha) * b;
        const child2 = (1 - alpha) * a + alpha * b;
        return [child1, child2];
      }
      case 'single_point':
      case 'two_point':
        return Math.random() < 0.5 ? [a, b] : [b, a];
      default:
        return Math.random() < 0.5 ? [a, b] : [b, a];
    }
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const minLen = Math.min(a.length, b.length);
    switch (type) {
      case 'single_point': {
        const point = Math.floor(Math.random() * minLen);
        return [
          [...a.slice(0, point), ...b.slice(point)],
          [...b.slice(0, point), ...a.slice(point)],
        ];
      }
      case 'two_point': {
        const p1 = Math.floor(Math.random() * minLen);
        const p2 = Math.floor(Math.random() * minLen);
        const [lo, hi] = p1 < p2 ? [p1, p2] : [p2, p1];
        return [
          [...a.slice(0, lo), ...b.slice(lo, hi), ...a.slice(hi)],
          [...b.slice(0, lo), ...a.slice(lo, hi), ...b.slice(hi)],
        ];
      }
      default: {
        const child1: unknown[] = [];
        const child2: unknown[] = [];
        const maxLen = Math.max(a.length, b.length);
        for (let i = 0; i < maxLen; i++) {
          const va = i < a.length ? a[i] : null;
          const vb = i < b.length ? b[i] : null;
          if (Math.random() < 0.5) {
            child1.push(va);
            child2.push(vb);
          } else {
            child1.push(vb);
            child2.push(va);
          }
        }
        return [child1, child2];
      }
    }
  }
  return Math.random() < 0.5 ? [a, b] : [b, a];
}
