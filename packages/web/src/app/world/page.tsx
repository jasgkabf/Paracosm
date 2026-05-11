"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { EntityGraphView } from "@/components/world/entity-graph-view";
import { WorldStats } from "@/components/world/world-stats";
import { Tabs } from "@/components/common/tabs";
import { useState } from "react";

export default function WorldPage() {
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "entities", label: "Entities", href: "/world/entities" },
    { id: "timeline", label: "Timeline", href: "/world/timeline" },
    { id: "constraints", label: "Constraints", href: "/world/constraints" },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">World Model</h1>
            <p className="text-sm text-gray-400 mt-1">
              Explore and manage the agent&apos;s world model
            </p>
          </div>
        </div>
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          <div className="lg:col-span-2 min-h-0">
            <EntityGraphView />
          </div>
          <div className="min-h-0 overflow-y-auto">
            <WorldStats />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
