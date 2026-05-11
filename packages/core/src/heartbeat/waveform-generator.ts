import type { WaveformPoint, HeartPhase } from "@paracosm/shared";
import {
  HEART_PHASE_IDLE,
  HEART_PHASE_LIGHT_WORK,
  HEART_PHASE_MEDIUM_WORK,
  HEART_PHASE_HEAVY_WORK,
  HEART_PHASE_SIMULATING,
  HEART_PHASE_DEBATING,
  HEART_PHASE_EVOLVING,
  HEART_PHASE_WAITING,
  HEART_PHASE_ERROR,
  HEART_PHASE_CRITICAL,
  HEART_PHASE_FLATLINE,
  HEART_PHASE_RECOVERING,
  WAVEFORM_POINTS,
} from "@paracosm/shared";
import type { OperationalPhase } from "@paracosm/shared";
import type { WaveformConfig } from "./types.js";
import { DEFAULT_WAVEFORM_CONFIG } from "./types.js";

export class WaveformGenerator {
  private config: WaveformConfig;
  private lastWaveformTime: number;

  constructor(config?: Partial<WaveformConfig>) {
    this.config = { ...DEFAULT_WAVEFORM_CONFIG, ...config };
    this.lastWaveformTime = 0;
  }

  generatePQRST(phase: HeartPhase, bpm: number, amplitude: number): WaveformPoint[] {
    if (bpm <= 0 || amplitude <= 0) {
      return this.generateFlatline();
    }

    const points: WaveformPoint[] = [];
    const beatDurationMs = 60000 / bpm;
    const totalPoints = this.config.sampleRate;
    const timeStep = beatDurationMs / totalPoints;

    const pStart = 0;
    const pEnd = this.config.pWaveDuration * 1000;
    const prEnd = pEnd + this.config.prSegmentDuration * 1000;
    const qStart = prEnd;
    const qEnd = qStart + this.config.qWaveDuration * 1000;
    const rStart = qEnd;
    const rEnd = rStart + this.config.rWaveDuration * 1000;
    const sStart = rEnd;
    const sEnd = sStart + this.config.sWaveDuration * 1000;
    const stEnd = sEnd + this.config.stSegmentDuration * 1000;
    const tStart = stEnd;
    const tEnd = tStart + this.config.tWaveDuration * 1000;
    const uStart = tEnd;
    const uEnd = uStart + this.config.uWaveDuration * 1000;

    const baseTime = Date.now();

    for (let i = 0; i < totalPoints; i++) {
      const t = i * timeStep;
      let value = this.config.baseline;

      if (t >= pStart && t < pEnd) {
        const progress = (t - pStart) / (pEnd - pStart);
        value = this.config.pWaveAmplitude * Math.sin(progress * Math.PI) * amplitude;
      } else if (t >= pEnd && t < prEnd) {
        value = this.config.baseline;
      } else if (t >= qStart && t < qEnd) {
        const progress = (t - qStart) / (qEnd - qStart);
        value = this.config.qWaveAmplitude * Math.sin(progress * Math.PI) * amplitude;
      } else if (t >= rStart && t < rEnd) {
        const progress = (t - rStart) / (rEnd - rStart);
        value = this.config.rWaveAmplitude * Math.sin(progress * Math.PI) * amplitude;
      } else if (t >= sStart && t < sEnd) {
        const progress = (t - sStart) / (sEnd - sStart);
        value = this.config.sWaveAmplitude * Math.sin(progress * Math.PI) * amplitude;
      } else if (t >= sEnd && t < stEnd) {
        const progress = (t - sEnd) / (stEnd - sStart);
        value = 0.02 * Math.sin(progress * Math.PI) * amplitude;
      } else if (t >= tStart && t < tEnd) {
        const progress = (t - tStart) / (tEnd - tStart);
        value = this.config.tWaveAmplitude * Math.sin(progress * Math.PI) * amplitude;
      } else if (t >= uStart && t < uEnd) {
        const progress = (t - uStart) / (uEnd - uStart);
        value = this.config.uWaveAmplitude * Math.sin(progress * Math.PI) * amplitude;
      } else {
        value = this.config.baseline;
      }

      let label: string | null = null;
      if (t >= pStart && t < pEnd) label = "P";
      else if (t >= qStart && t < qEnd) label = "Q";
      else if (t >= rStart && t < rEnd) label = "R";
      else if (t >= sStart && t < sEnd) label = "S";
      else if (t >= tStart && t < tEnd) label = "T";
      else if (t >= uStart && t < uEnd) label = "U";

      points.push({
        timestamp: new Date(baseTime + t).toISOString(),
        value: Math.round(value * 1000) / 1000,
        label,
      });
    }

    return points;
  }

  generateIdleWave(): WaveformPoint[] {
    return this.generatePQRST("diastole" as HeartPhase, 60, 0.3);
  }

  generateWorkWave(intensity: number): WaveformPoint[] {
    const clampedIntensity = Math.max(0, Math.min(1, intensity));
    const bpm = 80 + clampedIntensity * 40;
    const amplitude = 0.5 + clampedIntensity * 0.4;
    return this.generatePQRST("systole" as HeartPhase, bpm, amplitude);
  }

  generateStressWave(): WaveformPoint[] {
    const points: WaveformPoint[] = [];
    const baseTime = Date.now();
    const totalPoints = this.config.sampleRate;

    for (let i = 0; i < totalPoints; i++) {
      const t = i;
      let value = 0;

      const cyclePos = (i % 50) / 50;
      if (cyclePos < 0.05) {
        value = 0.15 * Math.sin(cyclePos / 0.05 * Math.PI);
      } else if (cyclePos < 0.1) {
        value = 0;
      } else if (cyclePos < 0.12) {
        value = -0.1 * Math.sin((cyclePos - 0.1) / 0.02 * Math.PI);
      } else if (cyclePos < 0.16) {
        value = 0.8 * Math.sin((cyclePos - 0.12) / 0.04 * Math.PI);
      } else if (cyclePos < 0.2) {
        value = -0.15 * Math.sin((cyclePos - 0.16) / 0.04 * Math.PI);
      } else if (cyclePos < 0.35) {
        value = 0.2 * Math.sin((cyclePos - 0.2) / 0.15 * Math.PI);
      } else {
        value = 0;
      }

      const irregularity = Math.sin(i * 0.3) * 0.05 + Math.sin(i * 0.7) * 0.03;
      value += irregularity;

      points.push({
        timestamp: new Date(baseTime + t * 10).toISOString(),
        value: Math.round(value * 1000) / 1000,
        label: null,
      });
    }

    return points;
  }

  generateErrorWave(): WaveformPoint[] {
    const points: WaveformPoint[] = [];
    const baseTime = Date.now();
    const totalPoints = this.config.sampleRate;

    for (let i = 0; i < totalPoints; i++) {
      const t = i;
      let value = 0;

      const beatInterval = 40 + Math.floor(Math.random() * 30);
      const beatPos = i % beatInterval;
      const beatProgress = beatPos / beatInterval;

      if (beatProgress < 0.02) {
        value = 0.1 * Math.sin(beatProgress / 0.02 * Math.PI);
      } else if (beatProgress < 0.06) {
        value = 0;
      } else if (beatProgress < 0.08) {
        value = -0.08 * Math.sin((beatProgress - 0.06) / 0.02 * Math.PI);
      } else if (beatProgress < 0.12) {
        value = 0.6 * Math.sin((beatProgress - 0.08) / 0.04 * Math.PI);
      } else if (beatProgress < 0.16) {
        value = -0.12 * Math.sin((beatProgress - 0.12) / 0.04 * Math.PI);
      } else if (beatProgress < 0.28) {
        value = 0.15 * Math.sin((beatProgress - 0.16) / 0.12 * Math.PI);
      } else {
        value = 0;
      }

      const noise = (Math.random() - 0.5) * 0.08;
      value += noise;

      const invertedBeat = Math.random() < 0.15;
      if (invertedBeat) {
        value = -value * 0.5;
      }

      points.push({
        timestamp: new Date(baseTime + t * 10).toISOString(),
        value: Math.round(value * 1000) / 1000,
        label: null,
      });
    }

    return points;
  }

  generateFlatline(): WaveformPoint[] {
    const points: WaveformPoint[] = [];
    const baseTime = Date.now();
    const totalPoints = this.config.sampleRate;

    for (let i = 0; i < totalPoints; i++) {
      const noise = (Math.random() - 0.5) * 0.005;
      points.push({
        timestamp: new Date(baseTime + i * 10).toISOString(),
        value: Math.round(noise * 1000) / 1000,
        label: null,
      });
    }

    return points;
  }

  generateRecovery(): WaveformPoint[] {
    const points: WaveformPoint[] = [];
    const baseTime = Date.now();
    const totalPoints = this.config.sampleRate;

    for (let i = 0; i < totalPoints; i++) {
      const progress = i / totalPoints;
      const bpm = 120 - progress * 60;
      const amplitude = 0.8 - progress * 0.5;

      const beatDurationMs = 60000 / Math.max(1, bpm);
      const timeInBeat = (i * 10) % beatDurationMs;
      const beatProgress = timeInBeat / beatDurationMs;

      let value = 0;

      if (beatProgress < 0.08) {
        value = 0.15 * Math.sin(beatProgress / 0.08 * Math.PI) * amplitude;
      } else if (beatProgress < 0.15) {
        value = 0;
      } else if (beatProgress < 0.18) {
        value = -0.1 * Math.sin((beatProgress - 0.15) / 0.03 * Math.PI) * amplitude;
      } else if (beatProgress < 0.22) {
        value = 1.0 * Math.sin((beatProgress - 0.18) / 0.04 * Math.PI) * amplitude;
      } else if (beatProgress < 0.26) {
        value = -0.2 * Math.sin((beatProgress - 0.22) / 0.04 * Math.PI) * amplitude;
      } else if (beatProgress < 0.4) {
        value = 0.25 * Math.sin((beatProgress - 0.26) / 0.14 * Math.PI) * amplitude;
      } else {
        value = 0;
      }

      const settlingNoise = (1 - progress) * (Math.random() - 0.5) * 0.03;
      value += settlingNoise;

      points.push({
        timestamp: new Date(baseTime + i * 10).toISOString(),
        value: Math.round(value * 1000) / 1000,
        label: null,
      });
    }

    return points;
  }

  generateWaveformForPhase(phase: OperationalPhase, bpm: number, amplitude: number): WaveformPoint[] {
    switch (phase) {
      case HEART_PHASE_IDLE as OperationalPhase:
        return this.generateIdleWave();
      case HEART_PHASE_LIGHT_WORK as OperationalPhase:
        return this.generateWorkWave(0.25);
      case HEART_PHASE_MEDIUM_WORK as OperationalPhase:
        return this.generateWorkWave(0.5);
      case HEART_PHASE_HEAVY_WORK as OperationalPhase:
        return this.generateWorkWave(0.75);
      case HEART_PHASE_SIMULATING as OperationalPhase:
        return this.generatePQRST("systole" as HeartPhase, bpm, amplitude);
      case HEART_PHASE_DEBATING as OperationalPhase:
        return this.generateStressWave();
      case HEART_PHASE_EVOLVING as OperationalPhase:
        return this.generatePQRST("systole" as HeartPhase, bpm, amplitude);
      case HEART_PHASE_WAITING as OperationalPhase:
        return this.generatePQRST("rest" as HeartPhase, bpm, amplitude);
      case HEART_PHASE_ERROR as OperationalPhase:
        return this.generateErrorWave();
      case HEART_PHASE_CRITICAL as OperationalPhase:
        return this.generateErrorWave();
      case HEART_PHASE_FLATLINE as OperationalPhase:
        return this.generateFlatline();
      case HEART_PHASE_RECOVERING as OperationalPhase:
        return this.generateRecovery();
      default:
        return this.generateIdleWave();
    }
  }

  interpolate(points: WaveformPoint[], targetLength: number): WaveformPoint[] {
    if (points.length === 0) return [];
    if (points.length === targetLength) return points;
    if (targetLength <= 0) return [];

    const result: WaveformPoint[] = [];

    for (let i = 0; i < targetLength; i++) {
      const srcIndex = (i / targetLength) * (points.length - 1);
      const lower = Math.floor(srcIndex);
      const upper = Math.min(lower + 1, points.length - 1);
      const fraction = srcIndex - lower;

      const value = points[lower].value * (1 - fraction) + points[upper].value * fraction;

      result.push({
        timestamp: points[Math.min(lower, points.length - 1)].timestamp,
        value: Math.round(value * 1000) / 1000,
        label: null,
      });
    }

    return result;
  }

  smooth(points: WaveformPoint[], windowSize: number): WaveformPoint[] {
    if (windowSize <= 1 || points.length <= windowSize) return points;

    const result: WaveformPoint[] = [];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < points.length; i++) {
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(points.length - 1, i + halfWindow);
      let sum = 0;
      let count = 0;

      for (let j = start; j <= end; j++) {
        sum += points[j].value;
        count++;
      }

      result.push({
        timestamp: points[i].timestamp,
        value: Math.round((sum / count) * 1000) / 1000,
        label: points[i].label,
      });
    }

    return result;
  }

  normalize(points: WaveformPoint[]): WaveformPoint[] {
    if (points.length === 0) return points;

    let min = Infinity;
    let max = -Infinity;

    for (const point of points) {
      if (point.value < min) min = point.value;
      if (point.value > max) max = point.value;
    }

    const range = max - min;
    if (range === 0) {
      return points.map((p) => ({
        timestamp: p.timestamp,
        value: 0,
        label: p.label,
      }));
    }

    return points.map((p) => ({
      timestamp: p.timestamp,
      value: Math.round(((p.value - min) / range) * 1000) / 1000,
      label: p.label,
    }));
  }

  generateContinuousWaveform(
    phase: OperationalPhase,
    bpm: number,
    amplitude: number,
    durationMs: number
  ): WaveformPoint[] {
    const targetPoints = Math.max(1, Math.floor(durationMs / 10));
    const rawPoints = this.generateWaveformForPhase(phase, bpm, amplitude);
    const interpolated = this.interpolate(rawPoints, targetPoints);
    const smoothed = this.smooth(interpolated, 3);
    return this.normalize(smoothed);
  }
}
