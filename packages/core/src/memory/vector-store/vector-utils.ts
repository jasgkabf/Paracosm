import { createLogger } from '@paracosm/shared';

const logger = createLogger('VectorUtils');

export function normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return vector;
  return vector.map((v) => v / magnitude);
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));
}

export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = dotProduct(a, b);
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

export function randomVector(dimensions: number, min: number = -1, max: number = 1): number[] {
  return Array.from({ length: dimensions }, () => min + Math.random() * (max - min));
}

export function zeroVector(dimensions: number): number[] {
  return new Array(dimensions).fill(0);
}

export function addVectors(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + (b[i] ?? 0));
}

export function scaleVector(vector: number[], scalar: number): number[] {
  return vector.map((v) => v * scalar);
}

export function averageVectors(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dimensions = vectors[0].length;
  const result = new Array(dimensions).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < dimensions; i++) {
      result[i] += vector[i] ?? 0;
    }
  }
  return result.map((v) => v / vectors.length);
}
