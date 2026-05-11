import { createLogger } from '@paracosm/shared';
import type { WaveformSample } from './types.js';

const logger = createLogger('WaveformGenerator');

export class WaveformGenerator {
  private sampleRate: number;
  private durationSeconds: number;
  private amplitudeScale: number;

  constructor(sampleRate: number = 100, durationSeconds: number = 2, amplitudeScale: number = 1.0) {
    this.sampleRate = sampleRate;
    this.durationSeconds = durationSeconds;
    this.amplitudeScale = amplitudeScale;
  }

  generate(bpm: number, rhythm: string): WaveformSample[] {
    const samples: WaveformSample[] = [];
    const totalSamples = this.sampleRate * this.durationSeconds;
    const beatsPerSecond = bpm / 60;
    const samplesPerBeat = this.sampleRate / beatsPerSecond;
    for (let i = 0; i < totalSamples; i++) {
      const t = i / this.sampleRate;
      const phase = (i % samplesPerBeat) / samplesPerBeat;
      let value = 0;
      if (phase < 0.05) {
        value = Math.sin(phase / 0.05 * Math.PI) * 0.8;
      } else if (phase < 0.15) {
        value = -Math.sin((phase - 0.05) / 0.1 * Math.PI) * 0.3;
      } else if (phase < 0.2) {
        value = Math.sin((phase - 0.15) / 0.05 * Math.PI) * 1.0;
      } else if (phase < 0.35) {
        value = -Math.sin((phase - 0.2) / 0.15 * Math.PI) * 0.2;
      } else {
        value = 0;
      }
      if (rhythm === 'irregular') {
        value += (Math.random() - 0.5) * 0.1;
      } else if (rhythm === 'elevated') {
        value *= 1.1;
      } else if (rhythm === 'tachycardic') {
        value *= 1.2;
      }
      samples.push({
        timestamp: t * 1000,
        value: value * this.amplitudeScale,
      });
    }
    return samples;
  }

  generateContinuous(bpm: number, rhythm: string, durationMs: number): WaveformSample[] {
    const totalSamples = Math.floor(this.sampleRate * durationMs / 1000);
    const beatsPerSecond = bpm / 60;
    const samplesPerBeat = this.sampleRate / beatsPerSecond;
    const samples: WaveformSample[] = [];
    for (let i = 0; i < totalSamples; i++) {
      const t = i / this.sampleRate;
      const phase = (i % samplesPerBeat) / samplesPerBeat;
      let value = 0;
      if (phase < 0.05) value = Math.sin(phase / 0.05 * Math.PI) * 0.8;
      else if (phase < 0.15) value = -Math.sin((phase - 0.05) / 0.1 * Math.PI) * 0.3;
      else if (phase < 0.2) value = Math.sin((phase - 0.15) / 0.05 * Math.PI) * 1.0;
      else if (phase < 0.35) value = -Math.sin((phase - 0.2) / 0.15 * Math.PI) * 0.2;
      samples.push({ timestamp: t * 1000, value: value * this.amplitudeScale });
    }
    return samples;
  }
}
