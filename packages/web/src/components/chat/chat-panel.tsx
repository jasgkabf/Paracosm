"use client";

import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { ChatHeader } from "./chat-header";
import { StreamIndicator } from "./stream-indicator";
import { useChat } from "@/hooks/use-chat";
import { useState } from "react";

interface ChatPanelProps {
  conversationId: string | null;
}

export function ChatPanel({ conversationId }: ChatPanelProps) {
  const {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    isLoading,
  } = useChat(conversationId);
  const [selectedModel, setSelectedModel] = useState("default");

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        conversationId={conversationId}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
      />

      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-paracosm-green/30 border-t-paracosm-green rounded-full animate-spin" />
              <span className="text-sm text-gray-400">Loading conversation...</span>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-paracosm-green/10 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-paracosm-green">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Start a conversation
              </h2>
              <p className="text-gray-400 text-sm">
                Send a message to begin interacting with the Paracosm agent.
                The agent can use world modeling, simulation, and strategy tools.
              </p>
            </div>
          </div>
        ) : (
          <MessageList messages={messages} isStreaming={isStreaming} />
        )}
      </div>

      {isStreaming && (
        <StreamIndicator onStop={stopStreaming} />
      )}

      <MessageInput
        onSend={sendMessage}
        disabled={isStreaming}
        placeholder={
          isStreaming
            ? "Agent is responding..."
            : "Send a message to the agent..."
        }
      />
    </div>
  );
}
