'use client';

import { useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  model?: string;
  toolName?: string;
  toolResult?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface ChatApiResponse {
  success: boolean;
  data: {
    id: string;
    requestId: string;
    message: {
      id: string;
      role: string;
      content: string;
      timestamp: string;
    };
    model: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    finishReason: string;
    duration: number;
  };
}

interface ToolCallEvent {
  type: 'tool_call';
  toolName: string;
  args?: Record<string, unknown>;
}

interface ToolResultEvent {
  type: 'tool_result';
  toolName: string;
  result: string;
}

interface StreamMessageEvent {
  type: 'message';
  content: string;
}

interface StreamDoneEvent {
  type: 'done';
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

type StreamEvent = StreamMessageEvent | ToolCallEvent | ToolResultEvent | StreamDoneEvent;

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [currentUsage, setCurrentUsage] = useState<ChatMessage['usage'] | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const buildHistory = useCallback(() => {
    return messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setActiveTool(null);

      try {
        const history = [...buildHistory(), { role: 'user' as const, content }];

        abortRef.current = new AbortController();

        const res = await fetch(`${apiClient.baseUrl}/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content, history }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const fallbackRes = await apiClient.post<ChatApiResponse>('/chat', {
            message: content,
            history,
          });

          if (fallbackRes.success && fallbackRes.data) {
            const { message: msg, model, usage } = fallbackRes.data;
            const assistantMsg: ChatMessage = {
              id: msg.id || `assistant-${Date.now()}`,
              role: 'assistant',
              content: msg.content,
              timestamp: Date.now(),
              model,
              usage,
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setCurrentModel(model);
            setCurrentUsage(usage);
          }
          return;
        }

        if (!res.body) {
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantId = `assistant-${Date.now()}`;
        let fullContent = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const event: StreamEvent = JSON.parse(data);

                if (event.type === 'message') {
                  fullContent += event.content;
                  setMessages((prev) => {
                    const existing = prev.find((m) => m.id === assistantId);
                    if (existing) {
                      return prev.map((m) =>
                        m.id === assistantId ? { ...m, content: fullContent } : m
                      );
                    }
                    return [
                      ...prev,
                      {
                        id: assistantId,
                        role: 'assistant' as const,
                        content: fullContent,
                        timestamp: Date.now(),
                      },
                    ];
                  });
                } else if (event.type === 'tool_call') {
                  setActiveTool(event.toolName);
                  const toolMsg: ChatMessage = {
                    id: `tool-call-${Date.now()}`,
                    role: 'tool',
                    content: '',
                    timestamp: Date.now(),
                    toolName: event.toolName,
                  };
                  setMessages((prev) => [...prev, toolMsg]);
                } else if (event.type === 'tool_result') {
                  setActiveTool(null);
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.role === 'tool' && m.toolName === event.toolName && !m.toolResult
                        ? { ...m, toolResult: event.result }
                        : m
                    )
                  );
                } else if (event.type === 'done') {
                  setCurrentModel(event.model);
                  if (event.usage) {
                    setCurrentUsage(event.usage);
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId ? { ...m, usage: event.usage, model: event.model } : m
                      )
                    );
                  }
                }
              } catch {
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;

        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'system',
          content: 'Failed to get response. Check your connection and API configuration.',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsStreaming(false);
        setActiveTool(null);
        abortRef.current = null;
      }
    },
    [buildHistory]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setCurrentModel(null);
    setCurrentUsage(null);
    setActiveTool(null);
  }, []);

  return {
    messages,
    sendMessage,
    isStreaming,
    stopStreaming,
    clearChat,
    currentModel,
    currentUsage,
    activeTool,
  };
}
