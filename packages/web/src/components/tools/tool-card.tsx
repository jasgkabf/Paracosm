"use client";

import { Badge } from "@/components/common/badge";
import { IconTool } from "@/components/icons";

interface Tool {
  id: string;
  name: string;
  description: string;
  type: "builtin" | "plugin" | "mcp";
  status: "active" | "inactive" | "error";
}

interface ToolCardProps {
  tool: Tool;
  selected?: boolean;
  onClick?: () => void;
}

const typeColors: Record<string, string> = {
  builtin: "text-paracosm-green",
  plugin: "text-paracosm-cyan",
  mcp: "text-paracosm-purple",
};

const statusColors: Record<string, string> = {
  active: "text-paracosm-green",
  inactive: "text-gray-500",
  error: "text-paracosm-red",
};

export function ToolCard({ tool, selected, onClick }: ToolCardProps) {
  return (
    <button
      onClick={onClick}
      className={`glass-panel p-4 text-left transition-colors glass-panel-hover ${
        selected ? "border-paracosm-green/30 bg-paracosm-green/5" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          tool.type === "builtin" ? "bg-paracosm-green/10" :
          tool.type === "plugin" ? "bg-paracosm-cyan/10" : "bg-paracosm-purple/10"
        }`}>
          <IconTool size={16} className={typeColors[tool.type]} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-white truncate">{tool.name}</h3>
            <Badge size="sm" className={typeColors[tool.type]}>{tool.type}</Badge>
          </div>
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{tool.description}</p>
          <div className="flex items-center gap-1 mt-2">
            <div className={`status-dot ${
              tool.status === "active" ? "status-dot-online" :
              tool.status === "error" ? "status-dot-error" : "status-dot-offline"
            }`} />
            <span className={`text-xs ${statusColors[tool.status]}`}>{tool.status}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
