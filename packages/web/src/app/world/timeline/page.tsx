"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { TimelineView } from "@/components/world/timeline-view";
import { TimelineEvent } from "@/components/world/timeline-event";
import { Button } from "@/components/common/button";
import { IconPlus } from "@/components/icons";
import { useState } from "react";

export default function TimelinePage() {
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const eventTypes = [
    { value: "all", label: "All Events" },
    { value: "action", label: "Actions" },
    { value: "observation", label: "Observations" },
    { value: "decision", label: "Decisions" },
    { value: "world_change", label: "World Changes" },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Timeline</h1>
            <p className="text-sm text-gray-400 mt-1">
              Chronological view of world model events
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-paracosm-gray border border-paracosm-gray-light rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-paracosm-green"
            >
              {eventTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <Button variant="primary" size="sm">
              <IconPlus size={16} />
              <span className="ml-2">Add Event</span>
            </Button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          <div className="lg:col-span-2 min-h-0">
            <TimelineView
              filterType={filterType}
              selectedEventId={selectedEvent}
              onSelectEvent={setSelectedEvent}
            />
          </div>
          <div className="min-h-0 overflow-y-auto">
            {selectedEvent ? (
              <TimelineEvent eventId={selectedEvent} />
            ) : (
              <div className="glass-panel p-6 text-center text-gray-500">
                Select an event to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
