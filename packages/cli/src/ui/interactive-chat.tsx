import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text, useInput, useApp } from "ink";
import chalk from "chalk";

interface ChatMessage {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: string;
  streaming?: boolean;
}

interface InteractiveChatProps {
  model: string;
  temperature: number;
  maxTokens: number;
  stream: boolean;
  systemPrompt?: string;
  baseUrl: string;
}

const STATUS_BAR_HEIGHT = 2;
const INPUT_HEIGHT = 3;
const MAX_VISIBLE_MESSAGES = 50;

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getColorForRole(role: string): string {
  switch (role) {
    case "system":
      return "yellow";
    case "user":
      return "cyan";
    case "assistant":
      return "green";
    default:
      return "white";
  }
}

function getLabelForRole(role: string): string {
  switch (role) {
    case "system":
      return "SYSTEM";
    case "user":
      return "YOU";
    case "assistant":
      return "AI";
    default:
      return role.toUpperCase();
  }
}

function MessageItem({ message }: { message: ChatMessage }): React.ReactElement {
  const color = getColorForRole(message.role);
  const label = getLabelForRole(message.role);
  const time = formatTimestamp(message.timestamp);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={color} bold>
          [{label}]
        </Text>
        <Text> </Text>
        <Text dimColor>{time}</Text>
        {message.streaming && (
          <Text color="yellow"> ...</Text>
        )}
      </Box>
      <Box marginLeft={2}>
        <Text>{message.content}</Text>
      </Box>
    </Box>
  );
}

function StatusBar({
  model,
  temperature,
  maxTokens,
  stream,
  messageCount,
  connected,
}: {
  model: string;
  temperature: number;
  maxTokens: number;
  stream: boolean;
  messageCount: number;
  connected: boolean;
}): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
    >
      <Box>
        <Text bold color="blue">
          Paracosm Chat
        </Text>
        <Text> | </Text>
        <Text dimColor>Model: </Text>
        <Text color="green">{model}</Text>
        <Text> | </Text>
        <Text dimColor>Temp: </Text>
        <Text>{temperature}</Text>
        <Text> | </Text>
        <Text dimColor>Max: </Text>
        <Text>{maxTokens}</Text>
        <Text> | </Text>
        <Text dimColor>Stream: </Text>
        <Text color={stream ? "green" : "red"}>{stream ? "on" : "off"}</Text>
      </Box>
      <Box>
        <Text dimColor>Messages: </Text>
        <Text>{messageCount}</Text>
        <Text> | </Text>
        <Text dimColor>Status: </Text>
        <Text color={connected ? "green" : "red"}>
          {connected ? "connected" : "disconnected"}
        </Text>
        <Text> | </Text>
        <Text dimColor>Ctrl+C: quit | Enter: send | Up/Down: history</Text>
      </Box>
    </Box>
  );
}

function InputArea({
  value,
  placeholder,
  active,
}: {
  value: string;
  placeholder: string;
  active: boolean;
}): React.ReactElement {
  return (
    <Box
      borderStyle="single"
      borderColor={active ? "cyan" : "gray"}
      paddingX={1}
    >
      <Text color="cyan" bold>
        {" > "}
      </Text>
      <Text>
        {value || (active ? "" : placeholder)}
      </Text>
      {active && <Text backgroundColor="cyan"> </Text>}
    </Box>
  );
}

function HelpOverlay(): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Text bold color="yellow">Keyboard Shortcuts</Text>
      <Text>  Enter       - Send message</Text>
      <Text>  Ctrl+C      - Exit chat</Text>
      <Text>  Up/Down     - Navigate history</Text>
      <Text>  Ctrl+L      - Clear screen</Text>
      <Text>  Ctrl+H      - Toggle this help</Text>
      <Text>  Escape      - Cancel current input</Text>
      <Text>  Tab         - Auto-complete commands</Text>
    </Box>
  );
}

export function InteractiveChat({
  model,
  temperature,
  maxTokens,
  stream,
  systemPrompt,
  baseUrl,
}: InteractiveChatProps): React.ReactElement {
  const { exit } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showHelp, setShowHelp] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);

  const messagesEndRef = useRef<number>(0);

  useEffect(() => {
    async function checkConnection(): Promise<void> {
      try {
        const response = await fetch(`${baseUrl}/heartbeat`);
        setConnected(response.ok);
      } catch {
        setConnected(false);
      }
    }
    checkConnection();
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, [baseUrl]);

  useEffect(() => {
    if (systemPrompt) {
      setMessages([
        {
          id: "system-0",
          role: "system",
          content: systemPrompt,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [systemPrompt]);

  useEffect(() => {
    setScrollOffset(0);
  }, [messages.length]);

  const sendMessage = useCallback(
    async (content: string): Promise<void> => {
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        streaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setLoading(true);

      const allMessages = [
        ...messages.filter((m) => m.role !== "system" || m.id === "system-0"),
        userMessage,
      ].map((m) => ({ role: m.role, content: m.content }));

      try {
        const requestBody = {
          messages: allMessages,
          model,
          temperature,
          maxTokens,
          stream,
        };

        const response = await fetch(`${baseUrl}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: `Error: ${errorBody}`, streaming: false }
                : m
            )
          );
          setLoading(false);
          return;
        }

        if (stream && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let fullContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));

            for (const line of lines) {
              const data = line.slice(6);
              if (data === "[DONE]") break;
              try {
                const parsed = JSON.parse(data) as { content?: string };
                if (parsed.content) {
                  fullContent += parsed.content;
                  const currentContent = fullContent;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? { ...m, content: currentContent }
                        : m
                    )
                  );
                }
              } catch {
                continue;
              }
            }
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, streaming: false }
                : m
            )
          );
        } else {
          const result = (await response.json()) as { content?: string };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: result.content ?? "", streaming: false }
                : m
            )
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? { ...m, content: `Connection error: ${message}`, streaming: false }
              : m
          )
        );
      }

      setLoading(false);
    },
    [messages, model, temperature, maxTokens, stream, baseUrl]
  );

  useInput((inputKey, key) => {
    if (key.ctrl && inputKey === "c") {
      exit();
      return;
    }

    if (key.ctrl && inputKey === "l") {
      setMessages((prev) => prev.filter((m) => m.role === "system"));
      setInput("");
      return;
    }

    if (key.ctrl && inputKey === "h") {
      setShowHelp((prev) => !prev);
      return;
    }

    if (key.escape) {
      setInput("");
      setHistoryIndex(-1);
      return;
    }

    if (key.upArrow) {
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(history[newIndex] ?? "");
      }
      return;
    }

    if (key.downArrow) {
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex] ?? "");
      } else {
        setHistoryIndex(-1);
        setInput("");
      }
      return;
    }

    if (key.return) {
      const trimmed = input.trim();
      if (!trimmed || loading) return;

      if (trimmed === "/quit" || trimmed === "/exit") {
        exit();
        return;
      }

      if (trimmed === "/clear") {
        setMessages((prev) => prev.filter((m) => m.role === "system"));
        setInput("");
        return;
      }

      if (trimmed === "/help") {
        setShowHelp((prev) => !prev);
        setInput("");
        return;
      }

      if (trimmed.startsWith("/model ")) {
        const newModel = trimmed.slice(7).trim();
        if (newModel) {
          setMessages((prev) => [
            ...prev,
            {
              id: `system-${Date.now()}`,
              role: "system",
              content: `Model switched to: ${newModel}`,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
        setInput("");
        return;
      }

      setHistory((prev) => [trimmed, ...prev].slice(0, 100));
      setHistoryIndex(-1);
      setInput("");
      sendMessage(trimmed);
      return;
    }

    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      return;
    }

    if (inputKey && !key.ctrl && !key.meta) {
      setInput((prev) => prev + inputKey);
    }
  });

  const visibleMessages = messages.slice(
    Math.max(0, messages.length - MAX_VISIBLE_MESSAGES - scrollOffset),
    messages.length - scrollOffset
  );

  return (
    <Box flexDirection="column" height="100%">
      <StatusBar
        model={model}
        temperature={temperature}
        maxTokens={maxTokens}
        stream={stream}
        messageCount={messages.filter((m) => m.role !== "system").length}
        connected={connected}
      />

      <Box flexDirection="column" flexGrow={1} paddingX={1} overflowY="hidden">
        {visibleMessages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
        {loading && (
          <Box marginLeft={2}>
            <Text color="yellow">Thinking...</Text>
          </Box>
        )}
      </Box>

      {showHelp && <HelpOverlay />}

      <InputArea
        value={input}
        placeholder={loading ? "Waiting for response..." : "Type a message..."}
        active={!loading}
      />
    </Box>
  );
}
