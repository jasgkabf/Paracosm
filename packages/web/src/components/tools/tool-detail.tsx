"use client";

import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/button";
import { IconTool, IconSettings, IconCode } from "@/components/icons";

interface ToolDetailProps {
  toolId: string;
  type?: string;
}

export function ToolDetail({ toolId, type = "builtin" }: ToolDetailProps) {
  return (
    <div className="glass-panel p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-paracosm-green/10 flex items-center justify-center">
            <IconTool size={20} className="text-paracosm-green" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Tool: {toolId}</h3>
            <Badge size="sm">{type}</Badge>
          </div>
        </div>
        <Button variant="ghost" size="sm">
          <IconSettings size={14} />
        </Button>
      </div>

      <div>
        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Description</h4>
        <p className="text-sm text-gray-300">
          This tool provides core functionality for the Paracosm agent platform.
        </p>
      </div>

      <div>
        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Parameters</h4>
        <div className="space-y-2">
          {[
            { name: "query", type: "string", required: true, description: "The search query" },
            { name: "limit", type: "number", required: false, description: "Max results to return" },
            { name: "format", type: "string", required: false, description: "Output format" },
          ].map((param) => (
            <div key={param.name} className="flex items-start gap-2 text-sm">
              <code className="text-paracosm-cyan bg-paracosm-dark/50 px-1.5 py-0.5 rounded text-xs">
                {param.name}
              </code>
              <span className="text-gray-500">{param.type}</span>
              {param.required && <Badge size="sm" className="text-paracosm-red">required</Badge>}
              <span className="text-gray-400">{param.description}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Usage Example</h4>
        <div className="bg-paracosm-dark/50 rounded-lg p-3">
          <pre className="text-xs text-gray-300 font-mono">
{`{
  "tool": "${toolId}",
  "params": {
    "query": "example",
    "limit": 10
  }
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
