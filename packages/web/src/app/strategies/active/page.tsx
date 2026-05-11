"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { StrategyList } from "@/components/strategy/strategy-list";
import { Badge } from "@/components/common/badge";

export default function ActiveStrategiesPage() {
  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-white">Active Strategies</h1>
              <p className="text-sm text-gray-400 mt-1">
                Currently running strategies and their performance
              </p>
            </div>
            <Badge variant="success">3 Active</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-panel p-4">
            <div className="text-sm text-gray-400">Avg Fitness Score</div>
            <div className="text-2xl font-mono text-paracosm-green ecg-glow mt-1">0.847</div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-sm text-gray-400">Generations Evolved</div>
            <div className="text-2xl font-mono text-paracosm-cyan mt-1">142</div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-sm text-gray-400">Active Strategies</div>
            <div className="text-2xl font-mono text-white mt-1">3</div>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <StrategyList filter="active" />
        </div>
      </div>
    </AppLayout>
  );
}
