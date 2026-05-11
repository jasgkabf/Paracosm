"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { ToolList } from "@/components/tools/tool-list";
import { ToolDetail } from "@/components/tools/tool-detail";
import { useState } from "react";

export default function BuiltinToolsPage() {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Built-in Tools</h1>
            <p className="text-sm text-gray-400 mt-1">
              Core tools included with the Paracosm agent
            </p>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          <div className="lg:col-span-2 min-h-0">
            <ToolList filter="builtin" onSelect={setSelectedTool} selectedId={selectedTool} />
          </div>
          <div className="min-h-0 overflow-y-auto">
            {selectedTool ? (
              <ToolDetail toolId={selectedTool} />
            ) : (
              <div className="glass-panel p-6 text-center text-gray-500">
                Select a tool to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
