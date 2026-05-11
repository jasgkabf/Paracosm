"use client";

import { useRef, useEffect } from "react";

export function FitnessChart() {
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

    const bestFitness = Array.from({ length: 40 }, (_, i) => 0.5 + 0.45 * (1 - Math.exp(-i / 10)));
    const avgFitness = Array.from({ length: 40 }, (_, i) => 0.4 + 0.35 * (1 - Math.exp(-i / 12)) + (Math.random() - 0.5) * 0.03);

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
    bestFitness.forEach((val, i) => {
      const x = padding.left + (i / (bestFitness.length - 1)) * chartW;
      const y = padding.top + (1 - val) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.strokeStyle = "rgba(0, 212, 255, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    avgFitness.forEach((val, i) => {
      const x = padding.left + (i / (avgFitness.length - 1)) * chartW;
      const y = padding.top + (1 - val) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = "rgba(0, 255, 136, 0.3)";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("Generation", w / 2, h - 5);

    const legendY = padding.top + 5;
    ctx.fillStyle = "#00ff88";
    ctx.fillRect(w - padding.right - 100, legendY, 12, 2);
    ctx.fillStyle = "rgba(0, 255, 136, 0.5)";
    ctx.textAlign = "left";
    ctx.fillText("Best", w - padding.right - 84, legendY + 4);

    ctx.fillStyle = "rgba(0, 212, 255, 0.6)";
    ctx.fillRect(w - padding.right - 100, legendY + 14, 12, 2);
    ctx.fillStyle = "rgba(0, 212, 255, 0.5)";
    ctx.fillText("Avg", w - padding.right - 84, legendY + 18);
  }, []);

  return (
    <canvas ref={canvasRef} className="w-full h-[200px] rounded-lg" />
  );
}
