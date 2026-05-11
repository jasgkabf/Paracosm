"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { useState } from "react";

export default function ChatPage() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  return (
    <AppLayout>
      <div className="flex h-full">
        <ChatSidebar
          selectedId={selectedConversation}
          onSelect={setSelectedConversation}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <ChatPanel conversationId={selectedConversation} />
        </div>
      </div>
    </AppLayout>
  );
}
