"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { ConstraintList } from "@/components/world/constraint-list";
import { GoalTree } from "@/components/world/goal-tree";
import { Button } from "@/components/common/button";
import { IconPlus } from "@/components/icons";
import { useState } from "react";

export default function ConstraintsPage() {
  const [activeView, setActiveView] = useState<"constraints" | "goals">("constraints");
  const [showCreateConstraint, setShowCreateConstraint] = useState(false);

  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Constraints & Goals</h1>
            <p className="text-sm text-gray-400 mt-1">
              Define rules and objectives for the world model
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-paracosm-gray rounded-md p-1">
              <button
                onClick={() => setActiveView("constraints")}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  activeView === "constraints"
                    ? "bg-paracosm-green/20 text-paracosm-green"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Constraints
              </button>
              <button
                onClick={() => setActiveView("goals")}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  activeView === "goals"
                    ? "bg-paracosm-green/20 text-paracosm-green"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Goals
              </button>
            </div>
            <Button variant="primary" size="sm" onClick={() => setShowCreateConstraint(true)}>
              <IconPlus size={16} />
              <span className="ml-2">
                {activeView === "constraints" ? "Add Constraint" : "Add Goal"}
              </span>
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {activeView === "constraints" ? (
            <ConstraintList />
          ) : (
            <GoalTree />
          )}
        </div>

        {showCreateConstraint && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="glass-panel p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold text-white mb-4">
                {activeView === "constraints" ? "New Constraint" : "New Goal"}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name</label>
                  <input
                    type="text"
                    className="w-full bg-paracosm-gray border border-paracosm-gray-light rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green"
                    placeholder={activeView === "constraints" ? "Constraint name" : "Goal name"}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    className="w-full bg-paracosm-gray border border-paracosm-gray-light rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green resize-none"
                    rows={3}
                    placeholder="Description"
                  />
                </div>
                {activeView === "constraints" && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Priority</label>
                    <select className="w-full bg-paracosm-gray border border-paracosm-gray-light rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green">
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="ghost" onClick={() => setShowCreateConstraint(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => setShowCreateConstraint(false)}>
                  Create
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
