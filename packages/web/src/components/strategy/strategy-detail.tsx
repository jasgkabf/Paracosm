"use client";

import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/button";
import { IconPlay, IconPause, IconEdit, IconTrash } from "@/components/icons";
import { useState } from "react";

interface StrategyDetailProps {
  strategyId: string;
}

export function StrategyDetail({ strategyId }: StrategyDetailProps) {
  const [isRunning, setIsRunning] = useState(true);

  const strategy = {
    id: strategyId,
    name: "Balanced Agent v3",
    type: "active",
    fitness: 0.85,
    generation: 15,
    status: isRunning ? "running" : "paused",
    parameters: {
      riskTolerance: 0.5,
      explorationFactor: 0.3,
      learningRate: 0.01,
      discountFactor: 0.95,
    },
    performance: {
      avgScore: 0.82,
      bestScore: 0.91,
      worstScore: 0.45,
      consistency: 0.78,
    },
  };

  return (
    <div className="glass-panel p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{strategy.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge size="sm">{strategy.type}</Badge>
            <Badge size="sm" className={isRunning ? "text-paracosm-green" : "text-paracosm-yellow"}>
              {strategy.status}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsRunning(!isRunning)}
          >
            {isRunning ? <IconPause size={16} /> : <IconPlay size={16} />}
          </Button>
          <Button variant="ghost" size="sm">
            <IconEdit size={16} />
          </Button>
          <Button variant="ghost" size="sm" className="text-paracosm-red">
            <IconTrash size={16} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-paracosm-dark/50 rounded-lg p-3">
          <div className="text-xs text-gray-500">Fitness Score</div>
          <div className="text-xl font-mono text-paracosm-green ecg-glow mt-1">
            {strategy.fitness.toFixed(2)}
          </div>
        </div>
        <div className="bg-paracosm-dark/50 rounded-lg p-3">
          <div className="text-xs text-gray-500">Generation</div>
          <div className="text-xl font-mono text-paracosm-cyan mt-1">
            {strategy.generation}
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Parameters</h4>
        <div className="space-y-2">
          {Object.entries(strategy.parameters).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="text-gray-400 capitalize">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </span>
              <span className="text-white font-mono">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Performance</h4>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(strategy.performance).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="text-gray-400 capitalize">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </span>
              <span className="text-white font-mono">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
