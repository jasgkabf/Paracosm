"use client";

import { Badge } from "@/components/common/badge";
import { Progress } from "@/components/common/progress";

interface Strategy {
  id: string;
  name: string;
  type: "active" | "evolved" | "custom";
  fitness: number;
  generation: number;
  status: "running" | "paused" | "completed";
}

interface StrategyCardProps {
  strategy: Strategy;
}

const typeColors: Record<string, string> = {
  active: "text-paracosm-green",
  evolved: "text-paracosm-cyan",
  custom: "text-paracosm-purple",
};

const statusColors: Record<string, string> = {
  running: "text-paracosm-green",
  paused: "text-paracosm-yellow",
  completed: "text-gray-400",
};

export function StrategyCard({ strategy }: StrategyCardProps) {
  return (
    <div className="glass-panel p-4 glass-panel-hover transition-colors cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-white">{strategy.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge size="sm" className={typeColors[strategy.type]}>
              {strategy.type}
            </Badge>
            <Badge size="sm" className={statusColors[strategy.status]}>
              {strategy.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">Fitness</span>
            <span className="font-mono text-paracosm-green">{strategy.fitness.toFixed(2)}</span>
          </div>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill bg-paracosm-green"
              style={{ width: `${strategy.fitness * 100}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Generation {strategy.generation}</span>
          <span className="font-mono">{(strategy.fitness * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}
