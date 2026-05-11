"use client";

import { useRef, useEffect } from "react";

interface Path {
  id: string;
  name: string;
  score: number;
  risk: number;
  steps: Array<{ x: number; y: number }>;
}

interface PathComparisonProps {
  simulationId: string;
  detailed?: boolean;
}

const mockPaths: Path[] = [
  {
    id: "p1",
    name: "Conservative",
    score: 0.72,
    risk: 0.15,
    steps: [
      { x: 50, y: 200 }, { x: 150, y: 180 }, { x: 250, y: 190 },
      { x: 350, y: 170 }, { x: 450, y: 175 }, { x: 550, y: 160 },
    ],
  },
  {
    id: "p2",
    name: "Balanced",
    score: 0.85,
    risk: 0.35,
    steps: [
      { x: 50, y: 200 }, { x: 150, y: 150 }, { x: 250, y: 170 },
      { x: 350, y: 120 }, { x: 450, y: 130 }, { x: 550, y: 100 },
    ],
  },
  {
    id: "p3",
    name: "Aggressive",
    score: 0.91,
    risk: 0.65,
    steps: [
      { x: 50, y: 200 }, { x: 150, y: 100 }, { x: 250, y: 140 },
      { x: 350, y: 60 }, { x: 450, y: 80 }, { x: 550, y: 40 },
    ],
  },
];

const pathColors = ["#00ff88", "#00d4ff", "#ff8800"];

export function PathComparison({ simulationId, detailed = false }: PathComparisonProps) {
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

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(0, 255, 136, 0.05)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    mockPaths.forEach((path, idx) => {
      ctx.strokeStyle = pathColors[idx];
      ctx.lineWidth = 2;
      ctx.beginPath();
      path.steps.forEach((step, i) => {
        if (i === 0) ctx.moveTo(step.x, step.y);
        else ctx.lineTo(step.x, step.y);
      });
      ctx.stroke();

      path.steps.forEach((step) => {
        ctx.fillStyle = pathColors[idx];
        ctx.beginPath();
        ctx.arc(step.x, step.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    ctx.font = "11px 'Inter', sans-serif";
    mockPaths.forEach((path, idx) => {
      const lastStep = path.steps[path.steps.length - 1];
      ctx.fillStyle = pathColors[idx];
      ctx.textAlign = "left";
      ctx.fillText(`${path.name} (${path.score})`, lastStep.x + 10, lastStep.y + 4);
    });
  }, [simulationId, detailed]);

  return (
    <div className="glass-panel p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Path Comparison</h3>
      <canvas ref={canvasRef} className="w-full h-[250px] rounded-lg" />
      <div className="flex items-center gap-4 mt-3">
        {mockPaths.map((path, idx) => (
          <div key={path.id} className="flex items-center gap-2">
            <div className="w-3 h-1 rounded" style={{ backgroundColor: pathColors[idx] }} />
            <span className="text-xs text-gray-400">{path.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
