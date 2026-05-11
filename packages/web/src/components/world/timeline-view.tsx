"use client";

import { TimelineEvent } from "./timeline-event";
import { useState } from "react";

interface TimelineEventItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: Date;
}

interface TimelineViewProps {
  filterType?: string;
  selectedEventId?: string | null;
  onSelectEvent?: (id: string) => void;
}

const mockEvents: TimelineEventItem[] = [
  { id: "t1", type: "action", title: "Agent started exploration", description: "Began exploring the world model", timestamp: new Date(Date.now() - 3600000) },
  { id: "t2", type: "observation", title: "New entity discovered", description: "Found a new location in the world", timestamp: new Date(Date.now() - 3000000) },
  { id: "t3", type: "decision", title: "Strategy selected", description: "Chose conservative approach", timestamp: new Date(Date.now() - 2400000) },
  { id: "t4", type: "world_change", title: "State updated", description: "World model updated with new information", timestamp: new Date(Date.now() - 1800000) },
  { id: "t5", type: "action", title: "Simulation initiated", description: "Started Monte Carlo simulation", timestamp: new Date(Date.now() - 1200000) },
  { id: "t6", type: "observation", title: "Results analyzed", description: "Simulation results processed", timestamp: new Date(Date.now() - 600000) },
];

const typeColors: Record<string, string> = {
  action: "bg-paracosm-green",
  observation: "bg-paracosm-cyan",
  decision: "bg-paracosm-purple",
  world_change: "bg-paracosm-yellow",
};

export function TimelineView({ filterType = "all", selectedEventId, onSelectEvent }: TimelineViewProps) {
  const [events] = useState<TimelineEventItem[]>(mockEvents);

  const filtered = filterType === "all"
    ? events
    : events.filter((e) => e.type === filterType);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div className="glass-panel p-4 h-full overflow-y-auto">
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-paracosm-gray-light/20" />
        <div className="space-y-4">
          {filtered.map((event) => (
            <button
              key={event.id}
              onClick={() => onSelectEvent?.(event.id)}
              className={`relative flex items-start gap-4 w-full text-left pl-8 pr-2 py-2 rounded-lg transition-colors ${
                selectedEventId === event.id
                  ? "bg-paracosm-green/5"
                  : "hover:bg-paracosm-gray/50"
              }`}
            >
              <div
                className={`absolute left-2.5 top-3 w-3 h-3 rounded-full border-2 border-paracosm-dark ${typeColors[event.type] || "bg-gray-500"}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{event.title}</span>
                  <span className="text-xs text-gray-500 font-mono">{formatTime(event.timestamp)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{event.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
