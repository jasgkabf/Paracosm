"use client";

import { ConversationSearch } from "./conversation-search";
import { IconPlus, IconChat, IconTrash } from "@/components/icons";
import { Button } from "@/components/common/button";
import { useState } from "react";

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messageCount: number;
}

interface ChatSidebarProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const mockConversations: Conversation[] = [
  { id: "1", title: "World building discussion", lastMessage: "Let me analyze the constraints...", timestamp: new Date(), messageCount: 12 },
  { id: "2", title: "Strategy optimization", lastMessage: "The fitness score improved by 15%", timestamp: new Date(Date.now() - 3600000), messageCount: 8 },
  { id: "3", title: "Simulation results", lastMessage: "Path A has lower risk but higher cost", timestamp: new Date(Date.now() - 7200000), messageCount: 24 },
];

export function ChatSidebar({ selectedId, onSelect }: ChatSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = conversations.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNewConversation = () => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: "New conversation",
      lastMessage: "",
      timestamp: new Date(),
      messageCount: 0,
    };
    setConversations((prev) => [newConv, ...prev]);
    onSelect(newConv.id);
  };

  const handleDelete = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) {
      onSelect(conversations[0]?.id || "");
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="w-72 border-r border-paracosm-gray-light/20 bg-paracosm-gray-dark/50 flex flex-col h-full">
      <div className="p-3 border-b border-paracosm-gray-light/20">
        <Button variant="primary" size="sm" className="w-full" onClick={handleNewConversation}>
          <IconPlus size={16} />
          <span className="ml-2">New Chat</span>
        </Button>
      </div>

      <div className="p-3">
        <ConversationSearch query={searchQuery} onQueryChange={setSearchQuery} />
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            {searchQuery ? "No matching conversations" : "No conversations yet"}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors group ${
                  selectedId === conv.id
                    ? "bg-paracosm-green/10 border border-paracosm-green/20"
                    : "hover:bg-paracosm-gray-light/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <IconChat size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-white truncate">
                        {conv.title}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {conv.lastMessage}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(conv.id);
                      }}
                      className="p-1 rounded text-gray-500 hover:text-paracosm-red transition-colors"
                    >
                      <IconTrash size={12} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-600">{formatTime(conv.timestamp)}</span>
                  <span className="text-xs text-gray-600">{conv.messageCount} messages</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
