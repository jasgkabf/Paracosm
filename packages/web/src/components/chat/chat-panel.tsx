'use client';

import { MessageList } from './message-list';
import { MessageInput } from './message-input';
import { useChat } from '@/hooks/use-chat';
import { Badge } from '@/components/common/badge';
import { IconTool, IconZap } from '@/components/icons';
import { useLocale } from '@/hooks/use-locale';

export function ChatPanel() {
  const {
    messages,
    sendMessage,
    isStreaming,
    stopStreaming,
    clearChat,
    currentModel,
    currentUsage,
    activeTool,
  } = useChat();
  const { t } = useLocale();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-paracosm-text">{t('nav.chat')}</h1>
        <div className="flex items-center gap-3">
          {currentModel && (
            <Badge variant="info">
              <span className="flex items-center gap-1">
                <IconZap size={10} />
                {currentModel}
              </span>
            </Badge>
          )}
          {currentUsage && (
            <span className="text-xs text-paracosm-muted font-mono">
              {t('chat.tokens')}: {currentUsage.totalTokens}
            </span>
          )}
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-xs text-paracosm-muted hover:text-paracosm-text transition-colors px-2 py-1 rounded border border-paracosm-border hover:border-paracosm-green/30"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {activeTool && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-md bg-paracosm-cyan/5 border border-paracosm-cyan/15">
          <IconTool size={14} color="#00e5ff" />
          <span className="text-sm text-paracosm-cyan">
            {t('chat.usingTool')}: {activeTool}
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-paracosm-cyan animate-pulse" />
        </div>
      )}

      <div className="flex-1 min-h-0">
        <MessageList messages={messages} isStreaming={isStreaming} activeTool={activeTool} />
      </div>
      <MessageInput
        onSend={sendMessage}
        disabled={isStreaming}
        onStop={isStreaming ? stopStreaming : undefined}
      />
    </div>
  );
}
