"use client";

import { useRef, useEffect } from "react";

interface BpmHistoryPoint {
  timestamp: number;
  bpm: number;
  event?: string;
}

interface HeartbeatHistoryChartProps {
  data: BpmHistoryPoint[];
}

export function HeartbeatHistoryChart({ data }: HeartbeatHistoryChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

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

    const minBpm = Math.min(...data.map((d) => d.bpm)) - 5;
    const maxBpm = Math.max(...data.map((d) => d.bpm)) + 5;
    const bpmRange = maxBpm - minBpm || 1;

    ctx.strokeStyle = "rgba(0, 255, 136, 0.06)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      const bpmVal = maxBpm - (bpmRange / 4) * i;
      ctx.fillStyle = "rgba(0, 255, 136, 0.3)";
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(Math.round(bpmVal).toString(), padding.left - 5, y + 3);
    }

    ctx.strokeStyle = "rgba(0, 255, 136, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    data.forEach((point, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartW;
      const y = padding.top + ((maxBpm - point.bpm) / bpmRange) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
    gradient.addColorStop(0, "rgba(0, 255, 136, 0.15)");
    gradient.addColorStop(1, "rgba(0, 255, 136, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    data.forEach((point, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartW;
      const y = padding.top + ((maxBpm - point.bpm) / bpmRange) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(w - padding.right, h - padding.bottom);
    ctx.lineTo(padding.left, h - padding.bottom);
    ctx.closePath();
    ctx.fill();

    data.forEach((point) => {
      if (!point.event) return;
      const i = data.indexOf(point);
      const x = padding.left + (i / (data.length - 1)) * chartW;
      ctx.strokeStyle = "rgba(255, 204, 0, 0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, h - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(255, 204, 0, 0.7)";
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(point.event, x, padding.top - 5);
    });
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-[150px] rounded-lg"
    />
  );
}
