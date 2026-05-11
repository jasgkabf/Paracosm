import type { RhythmType } from '@paracosm/shared';

interface Point {
  x: number;
  y: number;
}

export class EcgRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private bpm: number;
  private rhythm: RhythmType;
  private trailBuffer: Point[][] = [];
  private maxTrailLength = 3;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.bpm = 72;
    this.rhythm = 'normal';
  }

  updateParams(bpm: number, rhythm: RhythmType) {
    this.bpm = bpm;
    this.rhythm = rhythm;
  }

  render(time: number, bpm: number, rhythm: RhythmType) {
    this.bpm = bpm;
    this.rhythm = rhythm;

    this.drawBackground();
    this.drawGrid();

    const points = this.calculateWaveform(time);
    this.trailBuffer.push(points);
    if (this.trailBuffer.length > this.maxTrailLength) {
      this.trailBuffer.shift();
    }

    this.drawAfterglow();
    this.drawWaveform(points);
    this.drawScanLine(time);
  }

  private drawBackground() {
    this.ctx.fillStyle = '#0a0a0f';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  private drawGrid() {
    const { ctx, width, height } = this;

    ctx.strokeStyle = 'rgba(0, 255, 136, 0.04)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(0, 255, 136, 0.08)';
    ctx.lineWidth = 0.8;
    for (let x = 0; x < width; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  private calculateWaveform(time: number): Point[] {
    const points: Point[] = [];
    const beatDuration = 60 / this.bpm;
    const pixelsPerSecond = this.width / 4;
    const centerY = this.height / 2;
    const amplitude = this.height * 0.35;

    for (let px = 0; px < this.width; px++) {
      const t = time - (this.width - px) / pixelsPerSecond;
      const beatPhase = ((t % beatDuration) + beatDuration) % beatDuration;
      const normalizedPhase = beatPhase / beatDuration;

      const y = centerY - this.pqrstWaveform(normalizedPhase) * amplitude;
      points.push({ x: px, y });
    }

    return points;
  }

  private pqrstWaveform(phase: number): number {
    if (this.rhythm === 'irregular') {
      phase = phase + Math.sin(phase * Math.PI * 7) * 0.02;
    }

    let value = 0;

    if (phase < 0.1) {
      value = 0.15 * Math.sin(phase / 0.1 * Math.PI);
    } else if (phase < 0.16) {
      value = 0;
    } else if (phase < 0.2) {
      const p = (phase - 0.16) / 0.04;
      value = -0.15 * Math.sin(p * Math.PI);
    } else if (phase < 0.22) {
      value = 0;
    } else if (phase < 0.24) {
      const p = (phase - 0.22) / 0.02;
      value = -0.1 * p;
    } else if (phase < 0.28) {
      const p = (phase - 0.24) / 0.04;
      value = -0.1 + 1.2 * p;
    } else if (phase < 0.32) {
      const p = (phase - 0.28) / 0.04;
      value = 1.1 - 1.4 * p;
    } else if (phase < 0.36) {
      const p = (phase - 0.32) / 0.04;
      value = -0.3 + 0.3 * p;
    } else if (phase < 0.5) {
      const p = (phase - 0.36) / 0.14;
      value = 0.2 * Math.sin(p * Math.PI);
    } else if (phase < 0.6) {
      const p = (phase - 0.5) / 0.1;
      value = -0.15 * Math.sin(p * Math.PI);
    } else {
      value = 0;
    }

    if (this.rhythm === 'tachycardic') {
      value *= 0.85;
    } else if (this.rhythm === 'bradycardic') {
      value *= 1.1;
    }

    return this.smooth(value, phase);
  }

  private smooth(value: number, phase: number): number {
    const edgeWidth = 0.02;
    if (phase < edgeWidth) {
      return value * (phase / edgeWidth);
    }
    if (phase > 1 - edgeWidth) {
      return value * ((1 - phase) / edgeWidth);
    }
    return value;
  }

  private drawWaveform(points: Point[]) {
    const { ctx } = this;

    ctx.beginPath();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 12;

    for (let i = 0; i < points.length; i++) {
      if (i === 0) {
        ctx.moveTo(points[i].x, points[i].y);
      } else {
        const prev = points[i - 1];
        const curr = points[i];
        const cpx = (prev.x + curr.x) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, cpx, (prev.y + curr.y) / 2);
      }
    }

    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  private drawAfterglow() {
    const { ctx } = this;

    for (let t = 0; t < this.trailBuffer.length - 1; t++) {
      const trail = this.trailBuffer[t];
      const opacity = 0.03 * (t + 1) / this.trailBuffer.length;

      ctx.beginPath();
      ctx.strokeStyle = `rgba(0, 255, 136, ${opacity})`;
      ctx.lineWidth = 1.5;

      for (let i = 0; i < trail.length; i++) {
        if (i === 0) {
          ctx.moveTo(trail[i].x, trail[i].y);
        } else {
          ctx.lineTo(trail[i].x, trail[i].y);
        }
      }

      ctx.stroke();
    }
  }

  private drawScanLine(time: number) {
    const { ctx, width, height } = this;
    const scanX = ((time * width / 4) % width);

    const gradient = ctx.createLinearGradient(scanX - 60, 0, scanX + 10, 0);
    gradient.addColorStop(0, 'rgba(0, 255, 136, 0)');
    gradient.addColorStop(0.7, 'rgba(0, 255, 136, 0.03)');
    gradient.addColorStop(1, 'rgba(0, 255, 136, 0.08)');

    ctx.fillStyle = gradient;
    ctx.fillRect(scanX - 60, 0, 70, height);
  }
}
