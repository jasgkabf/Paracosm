"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { EvolutionTree } from "@/components/strategy/evolution-tree";
import { FitnessChart } from "@/components/strategy/fitness-chart";
import { StrategyList } from "@/components/strategy/strategy-list";
import { Badge } from "@/components/common/badge";

export default function EvolvedStrategiesPage() {
  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-white">Evolved Strategies</h1>
              <p className="text-sm text-gray-400 mt-1">
                Strategies produced through genetic evolution
              </p>
            </div>
            <Badge variant="info">12 Evolved</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-panel p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Evolution Tree</h3>
            <EvolutionTree />
          </div>
          <div className="glass-panel p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Fitness Over Generations</h3>
            <FitnessChart />
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <StrategyList filter="evolved" />
        </div>
      </div>
    </AppLayout>
  );
}
