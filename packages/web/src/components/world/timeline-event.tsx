"use client";

import { Badge } from "@/components/common/badge";

interface TimelineEventProps {
  eventId: string;
}

const typeColors: Record<string, string> = {
  action: "text-paracosm-green",
  observation: "text-paracosm-cyan",
  decision: "text-paracosm-purple",
  world_change: "text-paracosm-yellow",
};

export function TimelineEvent({ eventId }: TimelineEventProps) {
  return (
    <div className="glass-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Event Details</h3>
        <Badge size="sm">ID: {eventId}</Badge>
      </div>
      <div className="space-y-2">
        <div>
          <span className="text-xs text-gray-500">Type</span>
          <div className={`text-sm font-mono ${typeColors.action}`}>action</div>
        </div>
        <div>
          <span className="text-xs text-gray-500">Timestamp</span>
          <div className="text-sm text-white font-mono">
            {new Date().toISOString()}
          </div>
        </div>
        <div>
          <span className="text-xs text-gray-500">Description</span>
          <p className="text-sm text-gray-300">
            Detailed information about this timeline event and its impact on the world model.
          </p>
        </div>
        <div>
          <span className="text-xs text-gray-500">Affected Entities</span>
          <div className="flex flex-wrap gap-1 mt-1">
            <Badge size="sm">Agent Core</Badge>
            <Badge size="sm">World State</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
