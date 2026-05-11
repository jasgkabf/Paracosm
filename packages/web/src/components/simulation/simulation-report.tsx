"use client";

import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/button";
import { IconDownload } from "@/components/icons";

interface SimulationReportProps {
  simulationId: string;
}

export function SimulationReport({ simulationId }: SimulationReportProps) {
  const report = {
    summary: "The Monte Carlo simulation analyzed 1000 decision paths across 50 iterations. The balanced strategy achieved the highest risk-adjusted score of 0.85 with moderate risk exposure.",
    keyFindings: [
      "Balanced strategy outperforms conservative by 18% in expected value",
      "Aggressive strategy has 65% risk of exceeding budget constraints",
      "Optimal path found at iteration 37 with score 0.91",
      "Risk-adjusted returns favor the balanced approach",
    ],
    recommendations: [
      "Adopt the balanced strategy for primary operations",
      "Implement circuit breaker at 80% budget utilization",
      "Monitor strategy drift with heartbeat metrics",
      "Schedule weekly re-simulation to adapt to changing conditions",
    ],
    metrics: {
      totalPaths: 1000,
      iterations: 50,
      bestScore: 0.91,
      avgScore: 0.78,
      worstScore: 0.42,
      convergenceIteration: 37,
    },
  };

  return (
    <div className="glass-panel p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Simulation Report</h3>
        <Button variant="ghost" size="sm">
          <IconDownload size={16} />
          <span className="ml-2">Export</span>
        </Button>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-400 mb-2">Summary</h4>
        <p className="text-sm text-gray-300">{report.summary}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Object.entries(report.metrics).map(([key, value]) => (
          <div key={key} className="bg-paracosm-dark/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 capitalize">{key.replace(/([A-Z])/g, " $1")}</div>
            <div className="text-lg font-mono text-white mt-1">{value}</div>
          </div>
        ))}
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-400 mb-2">Key Findings</h4>
        <ul className="space-y-2">
          {report.keyFindings.map((finding, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
              <div className="w-1.5 h-1.5 rounded-full bg-paracosm-green mt-1.5 flex-shrink-0" />
              {finding}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-400 mb-2">Recommendations</h4>
        <ul className="space-y-2">
          {report.recommendations.map((rec, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
              <div className="w-1.5 h-1.5 rounded-full bg-paracosm-cyan mt-1.5 flex-shrink-0" />
              {rec}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
