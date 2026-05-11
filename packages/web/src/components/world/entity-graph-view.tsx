"use client";

import { EntityNode } from "./entity-node";
import { RelationEdge } from "./relation-edge";
import { useRef, useEffect, useState, useCallback } from "react";

interface Entity {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
}

interface Relation {
  id: string;
  source: string;
  target: string;
  label: string;
}

interface EntityGraphViewProps {
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

const mockEntities: Entity[] = [
  { id: "e1", name: "Agent Core", type: "agent", x: 400, y: 200 },
  { id: "e2", name: "World State", type: "concept", x: 250, y: 100 },
  { id: "e3", name: "Memory Store", type: "object", x: 550, y: 100 },
  { id: "e4", name: "Task Queue", type: "object", x: 200, y: 300 },
  { id: "e5", name: "Strategy Engine", type: "agent", x: 600, y: 300 },
  { id: "e6", name: "Environment", type: "location", x: 400, y: 400 },
];

const mockRelations: Relation[] = [
  { id: "r1", source: "e1", target: "e2", label: "observes" },
  { id: "r2", source: "e1", target: "e3", label: "stores" },
  { id: "r3", source: "e1", target: "e4", label: "processes" },
  { id: "r4", source: "e1", target: "e5", label: "drives" },
  { id: "r5", source: "e2", target: "e6", label: "models" },
  { id: "r6", source: "e5", target: "e6", label: "simulates" },
];

export function EntityGraphView({ selectedId, onSelect }: EntityGraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [entities] = useState<Entity[]>(mockEntities);
  const [relations] = useState<Relation[]>(mockRelations);
  const [dragging, setDragging] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const draw = useCallback(() => {
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

    ctx.strokeStyle = "rgba(0, 255, 136, 0.03)";
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

    relations.forEach((rel) => {
      const source = entities.find((e) => e.id === rel.source);
      const target = entities.find((e) => e.id === rel.target);
      if (!source || !target) return;

      ctx.strokeStyle = "rgba(0, 212, 255, 0.3)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();

      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;
      ctx.fillStyle = "rgba(0, 212, 255, 0.6)";
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(rel.label, midX, midY - 5);
    });

    entities.forEach((entity) => {
      const isSelected = entity.id === selectedId;
      const radius = 30;

      if (isSelected) {
        ctx.shadowColor = "#00ff88";
        ctx.shadowBlur = 15;
      }

      const typeColors: Record<string, string> = {
        agent: "#00ff88",
        object: "#00d4ff",
        concept: "#aa66ff",
        location: "#ffcc00",
        event: "#ff8800",
      };
      const color = typeColors[entity.type] || "#888";

      ctx.fillStyle = isSelected ? `${color}33` : "#1a1a2e";
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.beginPath();
      ctx.arc(entity.x, entity.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;

      ctx.fillStyle = "#ffffff";
      ctx.font = "11px 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(entity.name, entity.x, entity.y + 4);

      ctx.fillStyle = color;
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillText(entity.type, entity.x, entity.y + radius + 14);
    });
  }, [entities, relations, selectedId]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clicked = entities.find((ent) => {
      const dx = ent.x - x;
      const dy = ent.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 30;
    });

    if (clicked) {
      setDragging(clicked.id);
      setOffset({ x: x - clicked.x, y: y - clicked.y });
      onSelect?.(clicked.id);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left - offset.x;
    const y = e.clientY - rect.top - offset.y;
    const entity = entities.find((ent) => ent.id === dragging);
    if (entity) {
      entity.x = x;
      entity.y = y;
      draw();
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px]">
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg border border-paracosm-green/10 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}
