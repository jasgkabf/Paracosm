"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { EntityGraphView } from "@/components/world/entity-graph-view";
import { EntityDetail } from "@/components/world/entity-detail";
import { Button } from "@/components/common/button";
import { IconPlus } from "@/components/icons";
import { useState } from "react";

export default function EntitiesPage() {
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Entities</h1>
            <p className="text-sm text-gray-400 mt-1">
              Browse and manage entities in the world model
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
          >
            <IconPlus size={16} />
            <span className="ml-2">New Entity</span>
          </Button>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          <div className="lg:col-span-2 min-h-0">
            <EntityGraphView
              selectedId={selectedEntity}
              onSelect={setSelectedEntity}
            />
          </div>
          <div className="min-h-0 overflow-y-auto">
            {selectedEntity ? (
              <EntityDetail entityId={selectedEntity} />
            ) : (
              <div className="glass-panel p-6 text-center text-gray-500">
                Select an entity to view details
              </div>
            )}
          </div>
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="glass-panel p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold text-white mb-4">Create Entity</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name</label>
                  <input
                    type="text"
                    className="w-full bg-paracosm-gray border border-paracosm-gray-light rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green"
                    placeholder="Entity name"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Type</label>
                  <select className="w-full bg-paracosm-gray border border-paracosm-gray-light rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green">
                    <option value="agent">Agent</option>
                    <option value="object">Object</option>
                    <option value="location">Location</option>
                    <option value="concept">Concept</option>
                    <option value="event">Event</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    className="w-full bg-paracosm-gray border border-paracosm-gray-light rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green resize-none"
                    rows={3}
                    placeholder="Entity description"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => setShowCreateModal(false)}>
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
