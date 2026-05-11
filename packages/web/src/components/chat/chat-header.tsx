"use client";

import { IconBrain, IconSidebar } from "@/components/icons";
import { Badge } from "@/components/common/badge";

interface ChatHeaderProps {
  conversationId: string | null;
  selectedModel: string;
  onModelChange: (model: string) => void;
}

export function ChatHeader({ conversationId, selectedModel, onModelChange }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between h-12 px-4 border-b border-paracosm-gray-light/20 bg-paracosm-gray-dark/30">
      <div className="flex items-center gap-3">
        <IconBrain size={18} className="text-paracosm-green" />
        <span className="text-sm font-medium text-white">
          {conversationId ? "Conversation" : "New Chat"}
        </span>
        <Badge variant="info" size="sm">
          {selectedModel}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          className="bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-paracosm-green/50"
        >
          <option value="default">Default Model</option>
          <option value="gpt-4">GPT-4</option>
          <option value="claude-3">Claude 3</option>
          <option value="local">Local Model</option>
        </select>
      </div>
    </div>
  );
}
