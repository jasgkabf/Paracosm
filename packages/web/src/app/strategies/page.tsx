"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { StrategyList } from "@/components/strategy/strategy-list";
import { Button } from "@/components/common/button";
import { IconPlus } from "@/components/icons";
import { useRouter } from "next/navigation";
import { Tabs } from "@/components/common/tabs";
import { useState } from "react";

export default function StrategiesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("all");

  const tabs = [
    { id: "all", label: "All Strategies" },
    { id: "active", label: "Active", href: "/strategies/active" },
    { id: "evolved", label: "Evolved", href: "/strategies/evolved" },
    { id: "custom", label: "Custom", href: "/strategies/custom" },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Strategies</h1>
            <p className="text-sm text-gray-400 mt-1">
              Manage and evolve agent strategies
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => router.push("/strategies/custom")}>
            <IconPlus size={16} />
            <span className="ml-2">New Strategy</span>
          </Button>
        </div>

        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="flex-1 min-h-0">
          <StrategyList filter={activeTab} />
        </div>
      </div>
    </AppLayout>
  );
}
