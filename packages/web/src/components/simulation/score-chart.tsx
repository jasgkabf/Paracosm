"use client";

import { useRef, useEffect } from "react";

interface ScoreChartProps {
  simulationId: string;
}

export function ScoreChart({ simulationId }: ScoreChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, w, h);

    const scores = Array.from({ length: 50 }, (_, i) => 0.5 + 0.4 * (1 - Math.exp(-i / 15)) + (Math.random() - 0.5) * 0.05);

    ctx.strokeStyle = "rgba(0, 255, 136, 0.06)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 2;
    ctx.beginPath();
    scores.forEach((score, i) => {
      const x = padding.left + (i / (scores.length - 1)) * chartW;
      const y = padding.top + (1 - score) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
    gradient.addColorStop(0, "rgba(0, 255, 136, 0.15)");
    gradient.addColorStop(1, "rgba(0, 255, 136, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    scores.forEach((score, i) => {
      const x = padding.left + (i / (scores.length - 1)) * chartW;
      const y = padding.top + (1 - score) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(w - padding.right, h - padding.bottom);
    ctx.lineTo(padding.left, h - padding.bottom);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(0, 255, 136, 0.3)";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("Iterations", w / 2, h - 5);
  }, [simulationId]);

  return (
    <div className="glass-panel p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Score Over Iterations</h3>
      <canvas ref={canvasRef} className="w-full h-[250px] rounded-lg" />
    </div>
  );
}
