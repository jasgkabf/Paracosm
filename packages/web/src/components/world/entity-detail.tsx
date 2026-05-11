"use client";

import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/button";
import { IconEdit, IconTrash, IconLink } from "@/components/icons";

interface EntityDetailProps {
  entityId: string;
}

const mockEntityData: Record<string, {
  name: string;
  type: string;
  description: string;
  properties: Record<string, string>;
  relations: Array<{ target: string; label: string }>;
  created: string;
  updated: string;
}> = {
  e1: {
    name: "Agent Core",
    type: "agent",
    description: "The central agent orchestrating all operations",
    properties: { version: "0.1.0", status: "active", persona: "default" },
    relations: [
      { target: "World State", label: "observes" },
      { target: "Memory Store", label: "stores" },
      { target: "Task Queue", label: "processes" },
    ],
    created: "2024-01-01",
    updated: "2024-01-15",
  },
};

export function EntityDetail({ entityId }: EntityDetailProps) {
  const entity = mockEntityData[entityId];

  if (!entity) {
    return (
      <div className="glass-panel p-6 text-center text-gray-500">
        Entity not found
      </div>
    );
  }

  return (
    <div className="glass-panel p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{entity.name}</h3>
          <Badge size="sm" className="mt-1">{entity.type}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm">
            <IconEdit size={14} />
          </Button>
          <Button variant="ghost" size="sm" className="text-paracosm-red">
            <IconTrash size={14} />
          </Button>
        </div>
      </div>

      <p className="text-sm text-gray-400">{entity.description}</p>

      <div>
        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Properties</h4>
        <div className="space-y-1">
          {Object.entries(entity.properties).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="text-gray-400">{key}</span>
              <span className="text-white font-mono">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Relations</h4>
        <div className="space-y-2">
          {entity.relations.map((rel, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <IconLink size={14} className="text-paracosm-cyan" />
              <span className="text-gray-400">{rel.label}</span>
              <span className="text-white">{rel.target}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-paracosm-gray-light/10">
        <span>Created: {entity.created}</span>
        <span>Updated: {entity.updated}</span>
      </div>
    </div>
  );
}
