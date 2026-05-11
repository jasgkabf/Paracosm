'use client';

import { useState } from 'react';
import { MessageList } from './message-list';
import { MessageInput } from './message-input';
import { useChat } from '@/hooks/use-chat';

export function ChatPanel() {
  const { messages, sendMessage, isStreaming } = useChat();
  const [selectedPersona, setSelectedPersona] = useState<string>('default');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-paracosm-text">Chat</h1>
        <select
          value={selectedPersona}
          onChange={(e) => setSelectedPersona(e.target.value)}
          className="bg-paracosm-dark border border-paracosm-border rounded-md px-3 py-1.5 text-sm text-paracosm-text focus:outline-none focus:border-paracosm-green/50"
        >
          <option value="default">Default</option>
          <option value="architect">Architect</option>
          <option value="dreamer">Dreamer</option>
          <option value="critic">Critic</option>
          <option value="curator">Curator</option>
          <option value="executor">Executor</option>
        </select>
      </div>
      <div className="flex-1 min-h-0">
        <MessageList messages={messages} isStreaming={isStreaming} />
      </div>
      <MessageInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  );
}
