'use client';

import { useRef, useEffect } from 'react';
import { MessageItem } from './message-item';
import { Spinner } from '@/components/common/spinner';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  persona?: string;
  model?: string;
}

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-paracosm-muted">
        <div className="text-center space-y-3">
          <div className="text-4xl font-mono text-paracosm-green/20">P</div>
          <p className="text-sm">Start a conversation with the Paracosm agent</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto h-full pr-2">
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
      {isStreaming && (
        <div className="flex items-center gap-2 px-4 py-2">
          <Spinner size="sm" />
          <span className="text-sm text-paracosm-muted">Thinking...</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
