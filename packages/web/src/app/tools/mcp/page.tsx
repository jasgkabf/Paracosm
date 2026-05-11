"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { McpConnector } from "@/components/tools/mcp-connector";
import { Button } from "@/components/common/button";
import { IconPlus } from "@/components/icons";
import { useState } from "react";

export default function McpPage() {
  const [showAddConnector, setShowAddConnector] = useState(false);

  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">MCP Connectors</h1>
            <p className="text-sm text-gray-400 mt-1">
              Manage Model Context Protocol server connections
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowAddConnector(true)}>
            <IconPlus size={16} />
            <span className="ml-2">Add Connector</span>
          </Button>
        </div>

        <div className="flex-1 min-h-0">
          <McpConnector />
        </div>

        {showAddConnector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="glass-panel p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold text-white mb-4">Add MCP Connector</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name</label>
                  <input
                    type="text"
                    className="w-full bg-paracosm-gray border border-paracosm-gray-light rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green"
                    placeholder="my-mcp-server"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Transport Type</label>
                  <select className="w-full bg-paracosm-gray border border-paracosm-gray-light rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green">
                    <option value="stdio">stdio</option>
                    <option value="sse">SSE</option>
                    <option value="websocket">WebSocket</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Command / URL</label>
                  <input
                    type="text"
                    className="w-full bg-paracosm-gray border border-paracosm-gray-light rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green"
                    placeholder="npx @modelcontextprotocol/server-filesystem"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="ghost" onClick={() => setShowAddConnector(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => setShowAddConnector(false)}>
                  Connect
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
