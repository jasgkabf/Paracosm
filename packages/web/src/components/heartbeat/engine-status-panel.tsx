"use client";

import { Progress } from "@/components/common/progress";

interface Engine {
  name: string;
  activity: number;
  status: "active" | "idle" | "error";
}

interface EngineStatusPanelProps {
  engines: Engine[];
}

const defaultEngines: Engine[] = [
  { name: "Orchestrator", activity: 78, status: "active" },
  { name: "World Model", activity: 45, status: "active" },
  { name: "Simulation", activity: 0, status: "idle" },
  { name: "Strategy", activity: 32, status: "active" },
  { name: "Memory", activity: 56, status: "active" },
  { name: "LLM Gateway", activity: 89, status: "active" },
];

export function EngineStatusPanel({ engines = defaultEngines }: EngineStatusPanelProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-paracosm-green";
      case "idle":
        return "text-gray-500";
      case "error":
        return "text-paracosm-red";
      default:
        return "text-gray-400";
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-paracosm-green";
      case "idle":
        return "bg-gray-600";
      case "error":
        return "bg-paracosm-red";
      default:
        return "bg-gray-600";
    }
  };

  return (
    <div className="glass-panel p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-4">Engine Status</h3>
      <div className="space-y-4">
        {engines.map((engine) => (
          <div key={engine.name}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div
                  className={`status-dot ${
                    engine.status === "active"
                      ? "status-dot-online"
                      : engine.status === "error"
                      ? "status-dot-error"
                      : "status-dot-offline"
                  }`}
                />
                <span className="text-sm text-white">{engine.name}</span>
              </div>
              <span className={`text-xs font-mono ${getStatusColor(engine.status)}`}>
                {engine.status === "active"
                  ? `${engine.activity}%`
                  : engine.status.toUpperCase()}
              </span>
            </div>
            <div className="progress-bar-track">
              <div
                className={`progress-bar-fill ${getProgressColor(engine.status)}`}
                style={{ width: `${engine.activity}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
