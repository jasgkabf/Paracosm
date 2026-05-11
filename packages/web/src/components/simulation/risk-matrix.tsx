"use client";

import { useRef, useEffect } from "react";

interface RiskMatrixProps {
  simulationId: string;
  detailed?: boolean;
}

interface RiskItem {
  name: string;
  likelihood: number;
  impact: number;
  category: string;
}

const mockRisks: RiskItem[] = [
  { name: "Budget Overrun", likelihood: 0.3, impact: 0.8, category: "financial" },
  { name: "Model Failure", likelihood: 0.15, impact: 0.9, category: "technical" },
  { name: "Data Loss", likelihood: 0.1, impact: 0.95, category: "security" },
  { name: "Latency Spike", likelihood: 0.4, impact: 0.5, category: "performance" },
  { name: "API Rate Limit", likelihood: 0.6, impact: 0.3, category: "operational" },
  { name: "Strategy Drift", likelihood: 0.25, impact: 0.6, category: "strategic" },
];

const categoryColors: Record<string, string> = {
  financial: "#ffcc00",
  technical: "#00d4ff",
  security: "#ff3366",
  performance: "#ff8800",
  operational: "#00ff88",
  strategic: "#aa66ff",
};

export function RiskMatrix({ simulationId, detailed = false }: RiskMatrixProps) {
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
    const padding = { top: 30, right: 20, bottom: 40, left: 50 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, w, h);

    const zones = [
      { x: 0, y: 0, w: 0.33, h: 0.33, color: "rgba(0, 255, 136, 0.05)" },
      { x: 0.33, y: 0, w: 0.34, h: 0.33, color: "rgba(255, 204, 0, 0.05)" },
      { x: 0.67, y: 0, w: 0.33, h: 0.33, color: "rgba(255, 51, 102, 0.05)" },
      { x: 0, y: 0.33, w: 0.33, h: 0.34, color: "rgba(0, 255, 136, 0.05)" },
      { x: 0.33, y: 0.33, w: 0.34, h: 0.34, color: "rgba(255, 204, 0, 0.05)" },
      { x: 0.67, y: 0.33, w: 0.33, h: 0.34, color: "rgba(255, 51, 102, 0.05)" },
      { x: 0, y: 0.67, w: 0.33, h: 0.33, color: "rgba(255, 204, 0, 0.05)" },
      { x: 0.33, y: 0.67, w: 0.34, h: 0.33, color: "rgba(255, 51, 102, 0.05)" },
      { x: 0.67, y: 0.67, w: 0.33, h: 0.33, color: "rgba(255, 51, 102, 0.08)" },
    ];

    zones.forEach((zone) => {
      ctx.fillStyle = zone.color;
      ctx.fillRect(
        padding.left + zone.x * chartW,
        padding.top + zone.y * chartH,
        zone.w * chartW,
        zone.h * chartH
      );
    });

    ctx.strokeStyle = "rgba(0, 255, 136, 0.1)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 10; i++) {
      const x = padding.left + (i / 10) * chartW;
      const y = padding.top + (i / 10) * chartH;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, h - padding.bottom);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
    }

    mockRisks.forEach((risk) => {
      const x = padding.left + risk.likelihood * chartW;
      const y = padding.top + (1 - risk.impact) * chartH;
      const color = categoryColors[risk.category] || "#888";

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "9px 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(risk.name, x, y - 12);
    });

    ctx.fillStyle = "rgba(0, 255, 136, 0.3)";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("Likelihood", w / 2, h - 5);
    ctx.save();
    ctx.translate(12, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Impact", 0, 0);
    ctx.restore();
  }, [simulationId, detailed]);

  return (
    <div className="glass-panel p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Risk Matrix</h3>
      <canvas ref={canvasRef} className="w-full h-[250px] rounded-lg" />
      <div className="flex flex-wrap gap-3 mt-3">
        {Object.entries(categoryColors).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-400 capitalize">{cat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
