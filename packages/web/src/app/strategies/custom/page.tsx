"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { StrategyDetail } from "@/components/strategy/strategy-detail";
import { Button } from "@/components/common/button";
import { IconPlus, IconDna } from "@/components/icons";
import { useState } from "react";

export default function CustomStrategiesPage() {
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);

  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Custom Strategies</h1>
            <p className="text-sm text-gray-400 mt-1">
              Design and configure custom agent strategies
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setShowBuilder(true)}>
              <IconDna size={16} />
              <span className="ml-2">Evolve New</span>
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowBuilder(true)}>
              <IconPlus size={16} />
              <span className="ml-2">Create Custom</span>
            </Button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          <div className="lg:col-span-2 min-h-0">
            {selectedStrategy ? (
              <StrategyDetail strategyId={selectedStrategy} />
            ) : (
              <div className="glass-panel p-8 text-center text-gray-500 h-full flex flex-col items-center justify-center">
                <IconDna size={48} className="text-paracosm-gray-light mb-4" />
                <p className="text-lg">Select a strategy or create a new one</p>
                <p className="text-sm mt-2">
                  Custom strategies allow fine-grained control over agent behavior
                </p>
              </div>
            )}
          </div>
          <div className="min-h-0 overflow-y-auto">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Your Strategies</h3>
              {["explorer-v1", "conservative-v2", "balanced-v3"].map((id) => (
                <button
                  key={id}
                  onClick={() => setSelectedStrategy(id)}
                  className={`w-full text-left glass-panel p-3 rounded-lg transition-colors ${
                    selectedStrategy === id
                      ? "border-paracosm-green/30 bg-paracosm-green/5"
                      : "hover:bg-paracosm-gray/80"
                  }`}
                >
                  <div className="text-sm font-medium text-white">{id}</div>
                  <div className="text-xs text-gray-500 mt-1">Custom strategy</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {showBuilder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="glass-panel p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <h2 className="text-lg font-semibold text-white mb-4">Strategy Builder</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Strategy Name</label>
                  <input
                    type="text"
                    className="w-full bg-paracosm-gray border border-paracosm-gray-light rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green"
                    placeholder="my-strategy"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    className="w-full bg-paracosm-gray border border-paracosm-gray-light rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green resize-none"
                    rows={3}
                    placeholder="Strategy description"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Risk Tolerance</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    defaultValue="50"
                    className="w-full accent-paracosm-green"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Conservative</span>
                    <span>Aggressive</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Exploration Factor</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    defaultValue="30"
                    className="w-full accent-paracosm-cyan"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Exploit</span>
                    <span>Explore</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="ghost" onClick={() => setShowBuilder(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => setShowBuilder(false)}>
                  Create Strategy
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
