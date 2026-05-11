"use client";

import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/button";
import { IconDownload, IconTool } from "@/components/icons";

interface Plugin {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  installed: boolean;
  downloads: number;
}

interface PluginMarketProps {
  onSelect?: (id: string) => void;
  selectedId?: string | null;
}

const mockPlugins: Plugin[] = [
  { id: "pl1", name: "Database Connector", description: "Connect to SQL and NoSQL databases", author: "Paracosm", version: "1.2.0", installed: true, downloads: 1250 },
  { id: "pl2", name: "Image Generator", description: "Generate images from text descriptions", author: "Community", version: "0.8.0", installed: false, downloads: 890 },
  { id: "pl3", name: "Email Sender", description: "Send emails via SMTP", author: "Community", version: "1.0.0", installed: false, downloads: 560 },
  { id: "pl4", name: "PDF Parser", description: "Extract text and data from PDF files", author: "Paracosm", version: "2.1.0", installed: true, downloads: 2100 },
];

export function PluginMarket({ onSelect, selectedId }: PluginMarketProps) {
  return (
    <div className="space-y-3">
      {mockPlugins.map((plugin) => (
        <div
          key={plugin.id}
          onClick={() => onSelect?.(plugin.id)}
          className={`glass-panel p-4 cursor-pointer transition-colors glass-panel-hover ${
            selectedId === plugin.id ? "border-paracosm-green/30" : ""
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-paracosm-cyan/10 flex items-center justify-center">
                <IconTool size={16} className="text-paracosm-cyan" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-white">{plugin.name}</h3>
                  <Badge size="sm">v{plugin.version}</Badge>
                  {plugin.installed && <Badge size="sm" className="text-paracosm-green">Installed</Badge>}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{plugin.description}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span>by {plugin.author}</span>
                  <span>{plugin.downloads} downloads</span>
                </div>
              </div>
            </div>
            {!plugin.installed && (
              <Button variant="ghost" size="sm">
                <IconDownload size={14} />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
