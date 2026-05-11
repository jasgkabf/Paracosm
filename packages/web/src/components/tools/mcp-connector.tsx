"use client";

import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/button";
import { IconPlug, IconTrash, IconRefresh } from "@/components/icons";
import { useState } from "react";

interface McpServer {
  id: string;
  name: string;
  transport: "stdio" | "sse" | "websocket";
  command: string;
  connected: boolean;
  tools: number;
}

const mockServers: McpServer[] = [
  { id: "mcp1", name: "Filesystem", transport: "stdio", command: "npx @mcp/server-filesystem", connected: true, tools: 5 },
  { id: "mcp2", name: "GitHub", transport: "stdio", command: "npx @mcp/server-github", connected: true, tools: 12 },
  { id: "mcp3", name: "PostgreSQL", transport: "stdio", command: "npx @mcp/server-postgres", connected: false, tools: 0 },
];

export function McpConnector() {
  const [servers, setServers] = useState<McpServer[]>(mockServers);

  const handleDelete = (id: string) => {
    setServers((prev) => prev.filter((s) => s.id !== id));
  };

  const handleReconnect = (id: string) => {
    setServers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, connected: true, tools: s.tools || 3 } : s))
    );
  };

  return (
    <div className="space-y-3">
      {servers.map((server) => (
        <div key={server.id} className="glass-panel p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`status-dot ${server.connected ? "status-dot-online" : "status-dot-offline"}`} />
              <div>
                <div className="flex items-center gap-2">
                  <IconPlug size={16} className={server.connected ? "text-paracosm-green" : "text-gray-500"} />
                  <h3 className="text-sm font-medium text-white">{server.name}</h3>
                  <Badge size="sm">{server.transport}</Badge>
                </div>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{server.command}</p>
                {server.connected && (
                  <span className="text-xs text-paracosm-green">{server.tools} tools available</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!server.connected && (
                <Button variant="ghost" size="sm" onClick={() => handleReconnect(server.id)}>
                  <IconRefresh size={14} />
                  <span className="ml-1">Connect</span>
                </Button>
              )}
              <Button variant="ghost" size="sm" className="text-paracosm-red" onClick={() => handleDelete(server.id)}>
                <IconTrash size={14} />
              </Button>
            </div>
          </div>
        </div>
      ))}

      {servers.length === 0 && (
        <div className="glass-panel p-8 text-center text-gray-500">
          No MCP connectors configured
        </div>
      )}
    </div>
  );
}
