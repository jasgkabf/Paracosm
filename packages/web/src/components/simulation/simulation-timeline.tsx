"use client";

import { Badge } from "@/components/common/badge";

interface SimulationTimelineProps {
  simulationId: string;
}

interface TimelineStep {
  id: string;
  label: string;
  status: "completed" | "active" | "pending";
  timestamp?: string;
  detail?: string;
}

const mockSteps: TimelineStep[] = [
  { id: "s1", label: "Initialization", status: "completed", timestamp: "0:00", detail: "Loaded world state and constraints" },
  { id: "s2", label: "Path Generation", status: "completed", timestamp: "0:05", detail: "Generated 1000 decision paths" },
  { id: "s3", label: "Monte Carlo Sampling", status: "completed", timestamp: "0:12", detail: "Sampled 500 paths per iteration" },
  { id: "s4", label: "Risk Analysis", status: "active", timestamp: "0:18", detail: "Analyzing risk factors" },
  { id: "s5", label: "Score Aggregation", status: "pending", detail: "Aggregating scores across paths" },
  { id: "s6", label: "Report Generation", status: "pending", detail: "Generating simulation report" },
];

const statusStyles: Record<string, { dot: string; line: string }> = {
  completed: { dot: "bg-paracosm-green", line: "bg-paracosm-green/30" },
  active: { dot: "bg-paracosm-cyan animate-pulse", line: "bg-paracosm-gray-light/20" },
  pending: { dot: "bg-gray-600", line: "bg-paracosm-gray-light/20" },
};

export function SimulationTimeline({ simulationId }: SimulationTimelineProps) {
  return (
    <div className="glass-panel p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-4">Simulation Timeline</h3>
      <div className="space-y-0">
        {mockSteps.map((step, index) => {
          const styles = statusStyles[step.status];
          return (
            <div key={step.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${styles.dot}`} />
                {index < mockSteps.length - 1 && (
                  <div className={`w-0.5 h-12 ${styles.line}`} />
                )}
              </div>
              <div className="pb-6">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${step.status === "pending" ? "text-gray-500" : "text-white"}`}>
                    {step.label}
                  </span>
                  {step.timestamp && (
                    <span className="text-xs text-gray-500 font-mono">{step.timestamp}</span>
                  )}
                  <Badge size="sm" className={
                    step.status === "completed" ? "text-paracosm-green" :
                    step.status === "active" ? "text-paracosm-cyan" : "text-gray-500"
                  }>
                    {step.status}
                  </Badge>
                </div>
                {step.detail && (
                  <p className="text-xs text-gray-400 mt-0.5">{step.detail}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
