'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { ChatPanel } from '@/components/chat/chat-panel';

export default function ChatPage() {
  return (
    <AppLayout>
      <ChatPanel />
    </AppLayout>
  );
}
