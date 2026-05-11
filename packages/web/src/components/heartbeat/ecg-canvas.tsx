"use client";

import { useRef, useEffect, useCallback } from "react";
import {
  createEcgRenderer,
  generateGridLines,
  mapToCanvas,
  calculateScanLinePosition,
  type EcgRendererConfig,
} from "./ecg-renderer";

interface EcgCanvasProps {
  bpm: number;
  status: string;
  width?: number;
  height?: number;
}

export function EcgCanvas({
  bpm,
  status,
  width: propWidth,
  height: propHeight,
}: EcgCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<typeof createEcgRenderer> | null>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 300 });

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({
          width: Math.floor(width),
          height: Math.floor(height) || 300,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const effectiveWidth = propWidth || canvasSize.width;
  const effectiveHeight = propHeight || canvasSize.height;

  useEffect(() => {
    rendererRef.current = createEcgRenderer({
      width: effectiveWidth,
      height: effectiveHeight,
      bpm,
    });
  }, [effectiveWidth, effectiveHeight]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setBpm(bpm);
    }
  }, [bpm]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, timestamp: number) => {
      if (!rendererRef.current) return;
      const renderer = rendererRef.current;
      const config = renderer.config;
      const w = effectiveWidth;
      const h = effectiveHeight;

      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      renderer.advance(dt);

      ctx.fillStyle = config.backgroundColor;
      ctx.fillRect(0, 0, w, h);

      const grid = generateGridLines(w, h);
      ctx.strokeStyle = config.gridColor;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (const x of grid.smallV) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (const y of grid.smallH) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      ctx.strokeStyle = config.gridMajorColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const x of grid.largeV) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (const y of grid.largeH) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      const buffer = renderer.buffer;
      const bufData = buffer.getBuffer();
      const bufSize = buffer.getSize();
      const scanPos = buffer.getScanPosition();
      const pixelsPerSample = w / bufSize;

      const afterglowLength = config.afterglowLength;
      const decayFactor = config.phosphorDecay;

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (let pass = 0; pass < 2; pass++) {
        const isGlow = pass === 0;
        ctx.strokeStyle = isGlow ? config.glowColor : config.lineColor;
        ctx.lineWidth = isGlow ? 3 : 1.5;
        ctx.beginPath();

        let started = false;
        for (let i = 0; i < bufSize; i++) {
          const distanceFromScan = (scanPos - i + bufSize) % bufSize;

          if (distanceFromScan > afterglowLength && distanceFromScan < bufSize - 10) {
            if (started) {
              ctx.stroke();
              ctx.beginPath();
              started = false;
            }
            continue;
          }

          let intensity = 1;
          if (distanceFromScan > 0 && distanceFromScan < afterglowLength) {
            intensity = Math.pow(decayFactor, distanceFromScan);
          } else if (distanceFromScan >= bufSize - 10) {
            intensity = 0.1;
          }

          if (intensity < 0.02) {
            if (started) {
              ctx.stroke();
              ctx.beginPath();
              started = false;
            }
            continue;
          }

          const x = i * pixelsPerSample;
          const y = mapToCanvas(bufData[i], h);

          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        if (started) {
          ctx.stroke();
        }
      }

      const scanX = calculateScanLinePosition(buffer, w);
      const gradient = ctx.createLinearGradient(scanX - 30, 0, scanX, 0);
      gradient.addColorStop(0, "rgba(0, 255, 136, 0)");
      gradient.addColorStop(1, "rgba(0, 255, 136, 0.15)");
      ctx.fillStyle = gradient;
      ctx.fillRect(scanX - 30, 0, 30, h);

      ctx.strokeStyle = "rgba(0, 255, 136, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(scanX, 0);
      ctx.lineTo(scanX, h);
      ctx.stroke();

      ctx.fillStyle = "rgba(0, 255, 136, 0.5)";
      ctx.font = "10px 'JetBrains Mono', monospace";
      const timeStr = `${renderer.getElapsedTime().toFixed(1)}s`;
      ctx.fillText(timeStr, scanX + 4, 14);

      ctx.fillStyle = "rgba(0, 255, 136, 0.3)";
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillText("25mm/s", w - 50, h - 8);
      ctx.fillText("10mm/mV", w - 50, h - 20);

      if (status === "flatline" || bpm === 0) {
        ctx.fillStyle = "rgba(255, 51, 102, 0.1)";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#ff3366";
        ctx.font = "bold 24px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("FLATLINE", w / 2, h / 2);
        ctx.textAlign = "start";
      }
    },
    [effectiveWidth, effectiveHeight, bpm, status]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = effectiveWidth * dpr;
    canvas.height = effectiveHeight * dpr;
    ctx.scale(dpr, dpr);

    lastTimeRef.current = 0;

    const animate = (timestamp: number) => {
      draw(ctx, timestamp);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw, effectiveWidth, effectiveHeight]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[200px]">
      <canvas
        ref={canvasRef}
        style={{ width: effectiveWidth, height: effectiveHeight }}
        className="rounded-lg border border-paracosm-green/10"
      />
    </div>
  );
}

import { useState } from "react";
