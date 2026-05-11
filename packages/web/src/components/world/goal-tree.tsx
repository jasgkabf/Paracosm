"use client";

import { IconCheck, IconChevronRight } from "@/components/icons";
import { useState } from "react";

interface Goal {
  id: string;
  name: string;
  description: string;
  status: "completed" | "in_progress" | "pending";
  priority: "high" | "medium" | "low";
  children?: Goal[];
}

const mockGoals: Goal[] = [
  {
    id: "g1",
    name: "Optimize Agent Performance",
    description: "Improve overall agent response quality and speed",
    status: "in_progress",
    priority: "high",
    children: [
      { id: "g1.1", name: "Reduce Latency", description: "Target < 200ms response time", status: "completed", priority: "high" },
      { id: "g1.2", name: "Improve Accuracy", description: "Increase task completion rate to 95%", status: "in_progress", priority: "high" },
      { id: "g1.3", name: "Optimize Token Usage", description: "Reduce average tokens per request by 20%", status: "pending", priority: "medium" },
    ],
  },
  {
    id: "g2",
    name: "Expand World Model",
    description: "Increase the depth and breadth of the world model",
    status: "in_progress",
    priority: "medium",
    children: [
      { id: "g2.1", name: "Add Entity Types", description: "Support 5+ entity types", status: "completed", priority: "medium" },
      { id: "g2.2", name: "Temporal Reasoning", description: "Enable time-based reasoning", status: "pending", priority: "medium" },
    ],
  },
  {
    id: "g3",
    name: "Safety Compliance",
    description: "Ensure all operations meet safety requirements",
    status: "completed",
    priority: "high",
  },
];

const statusIcons: Record<string, React.ReactNode> = {
  completed: <IconCheck size={14} className="text-paracosm-green" />,
  in_progress: <div className="w-3.5 h-3.5 rounded-full border-2 border-paracosm-cyan border-t-transparent animate-spin" />,
  pending: <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-600" />,
};

function GoalNode({ goal, depth = 0 }: { goal: Goal; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = goal.children && goal.children.length > 0;

  return (
    <div style={{ marginLeft: depth * 24 }}>
      <div className="flex items-center gap-2 py-2">
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 rounded text-gray-500 hover:text-white transition-colors"
          >
            <IconChevronRight size={14} className={`transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        )}
        {!hasChildren && <div className="w-5" />}
        {statusIcons[goal.status]}
        <span className={`text-sm ${goal.status === "completed" ? "text-gray-500 line-through" : "text-white"}`}>
          {goal.name}
        </span>
      </div>
      {expanded && hasChildren && (
        <div>
          {goal.children!.map((child) => (
            <GoalNode key={child.id} goal={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function GoalTree() {
  return (
    <div className="glass-panel p-4">
      <div className="space-y-1">
        {mockGoals.map((goal) => (
          <GoalNode key={goal.id} goal={goal} />
        ))}
      </div>
    </div>
  );
}
