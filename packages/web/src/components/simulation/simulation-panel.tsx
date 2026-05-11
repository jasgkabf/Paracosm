"use client";

import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/button";
import { IconPlay, IconRefresh } from "@/components/icons";
import { useState } from "react";

interface Simulation {
  id: string;
  name: string;
  status: "running" | "completed" | "failed" | "pending";
  paths: number;
  bestScore: number;
  createdAt: Date;
}

const mockSimulations: Simulation[] = [
  { id: "sim1", name: "Market Entry Strategy", status: "completed", paths: 1000, bestScore: 0.87, createdAt: new Date() },
  { id: "sim2", name: "Risk Assessment", status: "running", paths: 500, bestScore: 0.72, createdAt: new Date(Date.now() - 3600000) },
  { id: "sim3", name: "Resource Allocation", status: "completed", paths: 2000, bestScore: 0.91, createdAt: new Date(Date.now() - 7200000) },
];

const statusColors: Record<string, string> = {
  running: "text-paracosm-cyan",
  completed: "text-paracosm-green",
  failed: "text-paracosm-red",
  pending: "text-gray-400",
};

export function SimulationPanel() {
  const [simulations, setSimulations] = useState<Simulation[]>(mockSimulations);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-4">
          <div className="text-sm text-gray-400">Total Simulations</div>
          <div className="text-2xl font-mono text-white mt-1">{simulations.length}</div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-sm text-gray-400">Running</div>
          <div className="text-2xl font-mono text-paracosm-cyan mt-1">
            {simulations.filter((s) => s.status === "running").length}
          </div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-sm text-gray-400">Avg Best Score</div>
          <div className="text-2xl font-mono text-paracosm-green mt-1">
            {(simulations.reduce((a, s) => a + s.bestScore, 0) / simulations.length).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {simulations.map((sim) => (
          <div key={sim.id} className="glass-panel p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-white">{sim.name}</h3>
                  <Badge size="sm" className={statusColors[sim.status]}>
                    {sim.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                  <span>{sim.paths} paths</span>
                  <span>Best: {sim.bestScore.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {sim.status === "running" && (
                <Button variant="ghost" size="sm">
                  <IconRefresh size={14} className="animate-spin" />
                </Button>
              )}
              <Button variant="ghost" size="sm">
                View
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
