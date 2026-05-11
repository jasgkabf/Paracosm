const SAMPLE_RATE = 500;
const SWEEP_SPEED = 25;

export interface EcgPoint {
  x: number;
  y: number;
  intensity: number;
}

export interface EcgRendererConfig {
  width: number;
  height: number;
  bpm: number;
  gridColor: string;
  gridMajorColor: string;
  lineColor: string;
  glowColor: string;
  backgroundColor: string;
  sweepSpeed: number;
  phosphorDecay: number;
  afterglowLength: number;
}

export const DEFAULT_ECG_CONFIG: EcgRendererConfig = {
  width: 800,
  height: 300,
  bpm: 72,
  gridColor: "rgba(0, 255, 136, 0.06)",
  gridMajorColor: "rgba(0, 255, 136, 0.12)",
  lineColor: "#00ff88",
  glowColor: "rgba(0, 255, 136, 0.4)",
  backgroundColor: "#0a0a0f",
  sweepSpeed: SWEEP_SPEED,
  phosphorDecay: 0.92,
  afterglowLength: 80,
};

function gaussian(x: number, mu: number, sigma: number): number {
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

export function generatePqrstWave(t: number, heartRate: number): number {
  const rrInterval = 60 / heartRate;
  const phase = ((t % rrInterval) / rrInterval);

  let value = 0;

  const pStart = 0.0;
  const pPeak = 0.08;
  const pEnd = 0.16;
  if (phase >= pStart && phase < pEnd) {
    value += 0.15 * gaussian(phase, pPeak, 0.03);
  }

  const qStart = 0.16;
  const qPeak = 0.19;
  const qEnd = 0.22;
  if (phase >= qStart && phase < qEnd) {
    value -= 0.1 * gaussian(phase, qPeak, 0.01);
  }

  const rStart = 0.19;
  const rPeak = 0.22;
  const rEnd = 0.26;
  if (phase >= rStart && phase < rEnd) {
    value += 1.0 * gaussian(phase, rPeak, 0.012);
  }

  const sStart = 0.22;
  const sPeak = 0.26;
  const sEnd = 0.30;
  if (phase >= sStart && phase < sEnd) {
    value -= 0.2 * gaussian(phase, sPeak, 0.012);
  }

  const stStart = 0.30;
  const stEnd = 0.38;
  if (phase >= stStart && phase < stEnd) {
    value += 0.02 * gaussian(phase, 0.34, 0.03);
  }

  const tStart = 0.30;
  const tPeak = 0.42;
  const tEnd = 0.55;
  if (phase >= tStart && phase < tEnd) {
    value += 0.25 * gaussian(phase, tPeak, 0.05);
  }

  const uPeak = 0.62;
  if (phase >= 0.55 && phase < 0.70) {
    value += 0.03 * gaussian(phase, uPeak, 0.03);
  }

  return value;
}

export function interpolateWaveform(
  points: number[],
  targetLength: number
): number[] {
  if (points.length === 0) return new Array(targetLength).fill(0);
  if (points.length === targetLength) return [...points];

  const result: number[] = [];
  const ratio = (points.length - 1) / (targetLength - 1);

  for (let i = 0; i < targetLength; i++) {
    const srcIndex = i * ratio;
    const lower = Math.floor(srcIndex);
    const upper = Math.min(lower + 1, points.length - 1);
    const fraction = srcIndex - lower;
    result.push(points[lower] * (1 - fraction) + points[upper] * fraction);
  }

  return result;
}

export function smoothWaveform(points: number[], windowSize: number = 3): number[] {
  const result: number[] = [];
  const half = Math.floor(windowSize / 2);

  for (let i = 0; i < points.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = -half; j <= half; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < points.length) {
        sum += points[idx];
        count++;
      }
    }
    result.push(sum / count);
  }

  return result;
}

export function mapToCanvas(
  value: number,
  canvasHeight: number,
  scale: number = 1.0,
  baseline: number = 0.5
): number {
  const centerY = canvasHeight * baseline;
  return centerY - value * canvasHeight * 0.35 * scale;
}

export class EcgBuffer {
  private buffer: Float32Array;
  private writeIndex: number = 0;
  private size: number;

  constructor(size: number) {
    this.size = size;
    this.buffer = new Float32Array(size);
  }

  push(value: number): void {
    this.buffer[this.writeIndex % this.size] = value;
    this.writeIndex++;
  }

  getScanPosition(): number {
    return this.writeIndex % this.size;
  }

  getBuffer(): Float32Array {
    return this.buffer;
  }

  getSize(): number {
    return this.size;
  }

  getWriteIndex(): number {
    return this.writeIndex;
  }

  getRecentValues(count: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      const idx = (this.writeIndex - count + i + this.size) % this.size;
      result.push(this.buffer[idx]);
    }
    return result;
  }

  reset(): void {
    this.buffer.fill(0);
    this.writeIndex = 0;
  }
}

export function calculateScanLinePosition(
  buffer: EcgBuffer,
  canvasWidth: number
): number {
  const pos = buffer.getScanPosition();
  return (pos / buffer.getSize()) * canvasWidth;
}

export function generateGridLines(
  width: number,
  height: number,
  smallGrid: number = 20,
  largeGrid: number = 100
): { smallH: number[]; largeH: number[]; smallV: number[]; largeV: number[] } {
  const smallH: number[] = [];
  const largeH: number[] = [];
  const smallV: number[] = [];
  const largeV: number[] = [];

  for (let x = 0; x <= width; x += smallGrid) {
    smallV.push(x);
  }
  for (let x = 0; x <= width; x += largeGrid) {
    largeV.push(x);
  }
  for (let y = 0; y <= height; y += smallGrid) {
    smallH.push(y);
  }
  for (let y = 0; y <= height; y += largeGrid) {
    largeH.push(y);
  }

  return { smallH, largeH, smallV, largeV };
}

export function generateTimeAxis(
  width: number,
  pixelsPerSecond: number,
  startTime: number
): { positions: number[]; labels: string[] } {
  const positions: number[] = [];
  const labels: string[] = [];
  const interval = 1;

  for (let t = Math.ceil(startTime); t < startTime + width / pixelsPerSecond; t += interval) {
    const x = (t - startTime) * pixelsPerSecond;
    if (x >= 0 && x <= width) {
      positions.push(x);
      labels.push(`${t}s`);
    }
  }

  return { positions, labels };
}

export function addNoise(value: number, amplitude: number = 0.005): number {
  return value + (Math.random() - 0.5) * amplitude * 2;
}

export function createEcgRenderer(config: Partial<EcgRendererConfig> = {}) {
  const fullConfig = { ...DEFAULT_ECG_CONFIG, ...config };
  const bufferSize = Math.ceil(
    (fullConfig.width / fullConfig.sweepSpeed) * SAMPLE_RATE
  );
  const buffer = new EcgBuffer(bufferSize);
  let elapsedTime = 0;

  return {
    config: fullConfig,
    buffer,

    advance(dt: number): void {
      const samplesToGenerate = Math.ceil(dt * SAMPLE_RATE);
      for (let i = 0; i < samplesToGenerate; i++) {
        const t = elapsedTime + i / SAMPLE_RATE;
        const value = addNoise(generatePqrstWave(t, fullConfig.bpm));
        buffer.push(value);
      }
      elapsedTime += samplesToGenerate / SAMPLE_RATE;
    },

    setBpm(bpm: number): void {
      fullConfig.bpm = Math.max(0, Math.min(300, bpm));
    },

    getElapsedTime(): number {
      return elapsedTime;
    },

    reset(): void {
      buffer.reset();
      elapsedTime = 0;
    },
  };
}
