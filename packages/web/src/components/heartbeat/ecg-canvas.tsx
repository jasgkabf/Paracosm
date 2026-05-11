'use client';

import { useRef, useEffect, useCallback } from 'react';
import { EcgRenderer } from './ecg-renderer';
import type { RhythmType } from '@paracosm/shared';

interface EcgCanvasProps {
  bpm: number;
  rhythm: RhythmType;
  width?: number;
  height?: number;
}

export function EcgCanvas({ bpm, rhythm, width = 800, height = 200 }: EcgCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<EcgRenderer | null>(null);
  const frameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  const initRenderer = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    rendererRef.current = new EcgRenderer(ctx, width, height);
  }, [width, height]);

  const drawFrame = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    timeRef.current += 1 / 60;
    renderer.render(timeRef.current, bpm, rhythm);
    frameRef.current = requestAnimationFrame(drawFrame);
  }, [bpm, rhythm]);

  useEffect(() => {
    initRenderer();
    frameRef.current = requestAnimationFrame(drawFrame);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [initRenderer, drawFrame]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.updateParams(bpm, rhythm);
    }
  }, [bpm, rhythm]);

  return (
    <div className="relative w-full overflow-hidden rounded-md">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: `${height}px` }}
      />
      <div className="absolute top-2 left-3 flex items-center gap-2">
        <span className="text-xs font-mono text-paracosm-green/50">ECG II</span>
        <span className="text-xs font-mono text-paracosm-green/30">25mm/s</span>
      </div>
    </div>
  );
}
