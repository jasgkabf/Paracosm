"use client";

import { StrategyCard } from "./strategy-card";
import { useState } from "react";

interface Strategy {
  id: string;
  name: string;
  type: "active" | "evolved" | "custom";
  fitness: number;
  generation: number;
  status: "running" | "paused" | "completed";
}

interface StrategyListProps {
  filter?: string;
}

const mockStrategies: Strategy[] = [
  { id: "str1", name: "Conservative Explorer", type: "active", fitness: 0.72, generation: 1, status: "running" },
  { id: "str2", name: "Balanced Agent v3", type: "active", fitness: 0.85, generation: 15, status: "running" },
  { id: "str3", name: "Aggressive Optimizer", type: "evolved", fitness: 0.91, generation: 42, status: "completed" },
  { id: "str4", name: "Risk-Aware Navigator", type: "evolved", fitness: 0.78, generation: 28, status: "completed" },
  { id: "str5", name: "Custom Strategy A", type: "custom", fitness: 0.65, generation: 1, status: "paused" },
  { id: "str6", name: "Adaptive Learner", type: "evolved", fitness: 0.88, generation: 35, status: "completed" },
];

export function StrategyList({ filter = "all" }: StrategyListProps) {
  const [strategies] = useState<Strategy[]>(mockStrategies);

  const filtered = filter === "all"
    ? strategies
    : strategies.filter((s) => s.type === filter);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered.map((strategy) => (
        <StrategyCard key={strategy.id} strategy={strategy} />
      ))}
      {filtered.length === 0 && (
        <div className="col-span-full text-center text-gray-500 py-8">
          No strategies found
        </div>
      )}
    </div>
  );
}
