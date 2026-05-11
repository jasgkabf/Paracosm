"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { SimulationPanel } from "@/components/simulation/simulation-panel";
import { Button } from "@/components/common/button";
import { IconPlus } from "@/components/icons";
import { useRouter } from "next/navigation";

export default function SimulatePage() {
  const router = useRouter();

  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Simulations</h1>
            <p className="text-sm text-gray-400 mt-1">
              Run Monte Carlo simulations and explore decision paths
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => router.push("/simulate/new")}>
            <IconPlus size={16} />
            <span className="ml-2">New Simulation</span>
          </Button>
        </div>
        <div className="flex-1 min-h-0">
          <SimulationPanel />
        </div>
      </div>
    </AppLayout>
  );
}
