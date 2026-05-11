export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let sumSquares = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sumSquares += diff * diff;
  }

  return Math.sqrt(sumSquares);
}

export function normalize(vector: number[]): number[] {
  let norm = 0;
  for (let i = 0; i < vector.length; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);

  if (norm === 0) {
    return new Array(vector.length).fill(0);
  }

  return vector.map((v) => v / norm);
}

export function dimensionReduction(vectors: number[][], targetDim: number): number[][] {
  if (vectors.length === 0) return [];
  if (targetDim >= vectors[0].length) return vectors.map((v) => [...v]);

  const sourceDim = vectors[0].length;
  const projectionMatrix = generateRandomProjection(sourceDim, targetDim);

  return vectors.map((vector) => {
    const reduced = new Array(targetDim).fill(0);
    for (let i = 0; i < targetDim; i++) {
      for (let j = 0; j < sourceDim; j++) {
        reduced[i] += vector[j] * projectionMatrix[i][j];
      }
      reduced[i] *= Math.sqrt(sourceDim / targetDim);
    }
    return reduced;
  });
}

export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result += a[i] * b[i];
  }
  return result;
}

function generateRandomProjection(sourceDim: number, targetDim: number): number[][] {
  const matrix: number[][] = [];

  for (let i = 0; i < targetDim; i++) {
    const row: number[] = [];
    for (let j = 0; j < sourceDim; j++) {
      const r = Math.random() * 2 - 1;
      if (r < -0.333) {
        row.push(-1);
      } else if (r > 0.333) {
        row.push(1);
      } else {
        row.push(0);
      }
    }
    matrix.push(row);
  }

  return matrix;
}
