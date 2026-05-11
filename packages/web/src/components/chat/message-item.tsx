'use client';

import { IconParacosm, IconUser } from '@/components/icons';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  persona?: string;
  model?: string;
}

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-paracosm-muted bg-paracosm-gray/50 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-paracosm-cyan/10 text-paracosm-cyan'
            : 'bg-paracosm-green/10 text-paracosm-green'
        }`}
      >
        {isUser ? <IconUser size={16} /> : <IconParacosm size={16} color="#00ff88" />}
      </div>
      <div
        className={`max-w-[75%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-paracosm-cyan/10 border border-paracosm-cyan/20'
            : 'bg-paracosm-surface border border-paracosm-border'
        }`}
      >
        {!isUser && message.persona && (
          <div className="text-xs text-paracosm-green font-mono mb-1">{message.persona}</div>
        )}
        <div className="text-sm text-paracosm-text whitespace-pre-wrap">{message.content}</div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-paracosm-muted">
            {message.timestamp.toLocaleTimeString()}
          </span>
          {!isUser && message.model && (
            <span className="text-xs text-paracosm-muted/60 font-mono">{message.model}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function IconUser({ size = 24 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
