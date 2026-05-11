"use client";

import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { useState } from "react";

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.id as string;
  const [selectedId] = useState<string>(conversationId);

  return (
    <AppLayout>
      <div className="flex h-full">
        <ChatSidebar
          selectedId={selectedId}
          onSelect={() => {}}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <ChatPanel conversationId={selectedId} />
        </div>
      </div>
    </AppLayout>
  );
}
