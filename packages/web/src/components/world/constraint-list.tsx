"use client";

import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/button";
import { IconEdit, IconTrash, IconShield } from "@/components/icons";
import { useState } from "react";

interface Constraint {
  id: string;
  name: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  type: string;
  active: boolean;
}

const mockConstraints: Constraint[] = [
  { id: "c1", name: "Budget Limit", description: "Total spending must not exceed daily budget", priority: "critical", type: "resource", active: true },
  { id: "c2", name: "Safety Boundary", description: "Agent must not perform destructive actions without confirmation", priority: "critical", type: "safety", active: true },
  { id: "c3", name: "Response Time", description: "Agent should respond within 30 seconds", priority: "high", type: "performance", active: true },
  { id: "c4", name: "Data Retention", description: "Conversation data retained for 30 days", priority: "medium", type: "policy", active: true },
  { id: "c5", name: "Rate Limiting", description: "Maximum 100 API calls per minute", priority: "high", type: "resource", active: false },
];

const priorityColors: Record<string, string> = {
  critical: "text-paracosm-red",
  high: "text-paracosm-orange",
  medium: "text-paracosm-yellow",
  low: "text-gray-400",
};

export function ConstraintList() {
  const [constraints, setConstraints] = useState<Constraint[]>(mockConstraints);

  const toggleActive = (id: string) => {
    setConstraints((prev) =>
      prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c))
    );
  };

  return (
    <div className="space-y-3">
      {constraints.map((constraint) => (
        <div
          key={constraint.id}
          className={`glass-panel p-4 transition-colors ${
            !constraint.active ? "opacity-50" : ""
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <IconShield size={18} className={priorityColors[constraint.priority]} />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-white">{constraint.name}</h3>
                  <Badge size="sm" className={priorityColors[constraint.priority]}>
                    {constraint.priority}
                  </Badge>
                  <Badge size="sm">{constraint.type}</Badge>
                </div>
                <p className="text-xs text-gray-400 mt-1">{constraint.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleActive(constraint.id)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  constraint.active
                    ? "bg-paracosm-green/20 text-paracosm-green"
                    : "bg-gray-700 text-gray-400"
                }`}
              >
                {constraint.active ? "Active" : "Inactive"}
              </button>
              <Button variant="ghost" size="sm">
                <IconEdit size={14} />
              </Button>
              <Button variant="ghost" size="sm" className="text-paracosm-red">
                <IconTrash size={14} />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
