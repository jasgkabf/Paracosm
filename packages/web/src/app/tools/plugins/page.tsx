"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { PluginMarket } from "@/components/tools/plugin-market";
import { ToolDetail } from "@/components/tools/tool-detail";
import { Button } from "@/components/common/button";
import { IconRefresh } from "@/components/icons";
import { useState } from "react";

export default function PluginsPage() {
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Plugin Marketplace</h1>
            <p className="text-sm text-gray-400 mt-1">
              Browse and install community plugins
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            <IconRefresh size={16} />
            <span className="ml-2">Refresh</span>
          </Button>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          <div className="lg:col-span-2 min-h-0">
            <PluginMarket
              key={refreshKey}
              onSelect={setSelectedPlugin}
              selectedId={selectedPlugin}
            />
          </div>
          <div className="min-h-0 overflow-y-auto">
            {selectedPlugin ? (
              <ToolDetail toolId={selectedPlugin} type="plugin" />
            ) : (
              <div className="glass-panel p-6 text-center text-gray-500">
                Select a plugin to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
