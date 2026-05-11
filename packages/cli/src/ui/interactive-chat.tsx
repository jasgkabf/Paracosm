import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';

interface InteractiveChatProps {
  persona?: string;
  model?: string;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function InteractiveChat({
  persona = 'default',
  model,
  stream = true,
  temperature = 0.7,
  maxTokens = 4096,
}: InteractiveChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { exit } = useApp();

  useInput((char, key) => {
    if (key.escape) {
      exit();
      return;
    }

    if (key.return) {
      if (input.trim()) {
        sendMessage(input.trim());
        setInput('');
      }
      return;
    }

    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      return;
    }

    if (!key.ctrl && !key.meta) {
      setInput((prev) => prev + char);
    }
  });

  const sendMessage = async (message: string) => {
    const userMsg: ChatMessage = { role: 'user', content: message };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch('http://localhost:7529/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          personas: [persona],
          model,
          stream: false,
          temperature,
          maxTokens,
        }),
      });

      if (!res.ok) {
        setMessages((prev) => [...prev, { role: 'system', content: `Error: HTTP ${res.status}` }]);
        return;
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: (data as any).message ?? (data as any).content ?? 'No response' },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: 'Connection failed. Is the server running?' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="green">Paracosm Chat</Text>
        <Text color="gray"> | persona={persona} | Esc to exit</Text>
      </Box>

      {messages.map((msg, i) => (
        <Box key={i} marginBottom={0}>
          {msg.role === 'user' && (
            <Text>
              <Text color="cyan">{'>'}</Text> <Text>{msg.content}</Text>
            </Text>
          )}
          {msg.role === 'assistant' && (
            <Text>
              <Text color="green">{'<'}</Text> <Text>{msg.content}</Text>
            </Text>
          )}
          {msg.role === 'system' && (
            <Text color="yellow">{msg.content}</Text>
          )}
        </Box>
      ))}

      {loading && (
        <Text color="gray">Thinking...</Text>
      )}

      <Box marginTop={1}>
        <Text color="cyan">{'>'}</Text>
        <Text> {input}</Text>
        <Text color="gray">_</Text>
      </Box>
    </Box>
  );
}
