"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { ToolList } from "@/components/tools/tool-list";
import { Tabs } from "@/components/common/tabs";
import { useState } from "react";

export default function ToolsPage() {
  const [activeTab, setActiveTab] = useState("all");

  const tabs = [
    { id: "all", label: "All Tools" },
    { id: "builtin", label: "Built-in", href: "/tools/builtin" },
    { id: "plugins", label: "Plugins", href: "/tools/plugins" },
    { id: "mcp", label: "MCP", href: "/tools/mcp" },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Tools</h1>
            <p className="text-sm text-gray-400 mt-1">
              Manage agent tools, plugins, and MCP connectors
            </p>
          </div>
        </div>

        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="flex-1 min-h-0">
          <ToolList filter={activeTab} />
        </div>
      </div>
    </AppLayout>
  );
}
