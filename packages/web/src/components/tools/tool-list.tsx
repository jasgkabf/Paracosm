"use client";

import { ToolCard } from "./tool-card";
import { useState } from "react";

interface Tool {
  id: string;
  name: string;
  description: string;
  type: "builtin" | "plugin" | "mcp";
  status: "active" | "inactive" | "error";
}

interface ToolListProps {
  filter?: string;
  onSelect?: (id: string) => void;
  selectedId?: string | null;
}

const mockTools: Tool[] = [
  { id: "t1", name: "Web Search", description: "Search the web for information", type: "builtin", status: "active" },
  { id: "t2", name: "Code Executor", description: "Execute code in sandboxed environment", type: "builtin", status: "active" },
  { id: "t3", name: "File Manager", description: "Read and write files", type: "builtin", status: "active" },
  { id: "t4", name: "Database Query", description: "Query databases", type: "plugin", status: "active" },
  { id: "t5", name: "Image Generator", description: "Generate images from text", type: "plugin", status: "inactive" },
  { id: "t6", name: "FileSystem MCP", description: "MCP filesystem connector", type: "mcp", status: "active" },
];

export function ToolList({ filter = "all", onSelect, selectedId }: ToolListProps) {
  const [tools] = useState<Tool[]>(mockTools);

  const filtered = filter === "all"
    ? tools
    : tools.filter((t) => t.type === filter);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered.map((tool) => (
        <ToolCard
          key={tool.id}
          tool={tool}
          selected={selectedId === tool.id}
          onClick={() => onSelect?.(tool.id)}
        />
      ))}
    </div>
  );
}
