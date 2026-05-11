"use client";

import { useRef, useEffect } from "react";

interface TreeNode {
  id: string;
  generation: number;
  fitness: number;
  parentId: string | null;
  children: string[];
}

const mockNodes: TreeNode[] = [
  { id: "n1", generation: 0, fitness: 0.5, parentId: null, children: ["n2", "n3"] },
  { id: "n2", generation: 1, fitness: 0.6, parentId: "n1", children: ["n4", "n5"] },
  { id: "n3", generation: 1, fitness: 0.55, parentId: "n1", children: ["n6"] },
  { id: "n4", generation: 2, fitness: 0.72, parentId: "n2", children: ["n7", "n8"] },
  { id: "n5", generation: 2, fitness: 0.65, parentId: "n2", children: [] },
  { id: "n6", generation: 2, fitness: 0.68, parentId: "n3", children: ["n9"] },
  { id: "n7", generation: 3, fitness: 0.85, parentId: "n4", children: [] },
  { id: "n8", generation: 3, fitness: 0.78, parentId: "n4", children: [] },
  { id: "n9", generation: 3, fitness: 0.91, parentId: "n6", children: [] },
];

export function EvolutionTree() {
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

    const maxGen = Math.max(...mockNodes.map((n) => n.generation));
    const genHeight = h / (maxGen + 2);

    const positions: Record<string, { x: number; y: number }> = {};
    const genGroups: Record<number, string[]> = {};
    mockNodes.forEach((node) => {
      if (!genGroups[node.generation]) genGroups[node.generation] = [];
      genGroups[node.generation].push(node.id);
    });

    Object.entries(genGroups).forEach(([gen, ids]) => {
      const g = parseInt(gen);
      const y = genHeight * (g + 1);
      const spacing = w / (ids.length + 1);
      ids.forEach((id, i) => {
        positions[id] = { x: spacing * (i + 1), y };
      });
    });

    mockNodes.forEach((node) => {
      if (node.parentId && positions[node.parentId] && positions[node.id]) {
        const parent = positions[node.parentId];
        const child = positions[node.id];
        ctx.strokeStyle = "rgba(0, 212, 255, 0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(parent.x, parent.y);
        ctx.lineTo(child.x, child.y);
        ctx.stroke();
      }
    });

    mockNodes.forEach((node) => {
      const pos = positions[node.id];
      if (!pos) return;

      const fitness = node.fitness;
      const radius = 8 + fitness * 12;
      const color = fitness > 0.8 ? "#00ff88" : fitness > 0.6 ? "#00d4ff" : "#ff8800";

      ctx.fillStyle = color + "33";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(fitness.toFixed(2), pos.x, pos.y + 3);
    });

    ctx.fillStyle = "rgba(0, 255, 136, 0.3)";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    for (let g = 0; g <= maxGen; g++) {
      const y = genHeight * (g + 1);
      ctx.fillText(`Gen ${g}`, 5, y + 3);
    }
  }, []);

  return (
    <canvas ref={canvasRef} className="w-full h-[300px] rounded-lg" />
  );
}
