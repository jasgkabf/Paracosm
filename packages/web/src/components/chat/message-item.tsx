'use client';

import { IconParacosm, IconTool, IconTerminal } from '@/components/icons';
import { Badge } from '@/components/common/badge';
import { useLocale } from '@/hooks/use-locale';
import type { ChatMessage } from '@/hooks/use-chat';

interface MessageItemProps {
  message: ChatMessage;
}

export function MessageItem({ message }: MessageItemProps) {
  const { t } = useLocale();

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isTool = message.role === 'tool';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-paracosm-muted bg-paracosm-gray/50 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  if (isTool) {
    return (
      <div className="flex gap-3">
        <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-paracosm-cyan/10 text-paracosm-cyan">
          <IconTerminal size={16} />
        </div>
        <div className="max-w-[75%] rounded-lg px-4 py-3 bg-paracosm-cyan/5 border border-paracosm-cyan/15">
          <div className="flex items-center gap-2 mb-1">
            <IconTool size={12} />
            <span className="text-xs text-paracosm-cyan font-mono">{t('chat.toolCall')}: {message.toolName}</span>
          </div>
          {message.toolResult && (
            <div className="mt-2 p-2 rounded bg-paracosm-dark/50 border border-paracosm-border">
              <div className="text-xs text-paracosm-muted mb-1">{t('chat.toolResult')}:</div>
              <pre className="text-xs text-paracosm-text font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                {message.toolResult}
              </pre>
            </div>
          )}
          {!message.toolResult && (
            <div className="flex items-center gap-2 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-paracosm-cyan animate-pulse" />
              <span className="text-xs text-paracosm-muted">{t('chat.usingTool')}...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-paracosm-green/10 text-paracosm-green'
            : 'bg-paracosm-green/10 text-paracosm-green'
        }`}
      >
        {isUser ? (
          <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ) : (
          <IconParacosm size={16} color="#00ff88" />
        )}
      </div>
      <div
        className={`max-w-[75%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-paracosm-green/10 border border-paracosm-green/20'
            : 'bg-paracosm-surface border border-paracosm-border'
        }`}
      >
        {!isUser && message.model && (
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="info">{message.model}</Badge>
          </div>
        )}
        <div className="text-sm text-paracosm-text whitespace-pre-wrap">{message.content}</div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-paracosm-muted">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
          {message.usage && (
            <span className="text-xs text-paracosm-muted/60 font-mono">
              {t('chat.tokens')}: {message.usage.totalTokens}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
