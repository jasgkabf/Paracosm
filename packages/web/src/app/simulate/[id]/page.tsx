"use client";

import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { PathComparison } from "@/components/simulation/path-comparison";
import { ScoreChart } from "@/components/simulation/score-chart";
import { RiskMatrix } from "@/components/simulation/risk-matrix";
import { SimulationTimeline } from "@/components/simulation/simulation-timeline";
import { SimulationReport } from "@/components/simulation/simulation-report";
import { Tabs } from "@/components/common/tabs";
import { Badge } from "@/components/common/badge";
import { useState } from "react";

export default function SimulationDetailPage() {
  const params = useParams();
  const simulationId = params.id as string;
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "paths", label: "Paths" },
    { id: "scores", label: "Scores" },
    { id: "risks", label: "Risks" },
    { id: "timeline", label: "Timeline" },
    { id: "report", label: "Report" },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-white">
                Simulation {simulationId}
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Detailed simulation analysis and results
              </p>
            </div>
            <Badge variant="success">Completed</Badge>
          </div>
        </div>

        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="flex-1 min-h-0 overflow-y-auto">
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PathComparison simulationId={simulationId} />
              <RiskMatrix simulationId={simulationId} />
            </div>
          )}
          {activeTab === "paths" && (
            <PathComparison simulationId={simulationId} detailed />
          )}
          {activeTab === "scores" && (
            <ScoreChart simulationId={simulationId} />
          )}
          {activeTab === "risks" && (
            <RiskMatrix simulationId={simulationId} detailed />
          )}
          {activeTab === "timeline" && (
            <SimulationTimeline simulationId={simulationId} />
          )}
          {activeTab === "report" && (
            <SimulationReport simulationId={simulationId} />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
