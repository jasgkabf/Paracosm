"use client";

import { MessageMarkdown } from "./message-markdown";
import { MessageActions } from "./message-actions";
import { MessageCodeBlock } from "./message-code-block";
import { IconUser, IconBrain } from "@/components/icons";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  attachments?: Array<{ id: string; name: string; type: string; size: number }>;
  isStreaming?: boolean;
}

interface MessageItemProps {
  message: Message;
  isStreaming: boolean;
}

export function MessageItem({ message, isStreaming }: MessageItemProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="bg-paracosm-gray/50 rounded-lg px-4 py-2 text-sm text-gray-400">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""} animate-fade-in`}
    >
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          isUser
            ? "bg-paracosm-cyan/20 text-paracosm-cyan"
            : "bg-paracosm-green/20 text-paracosm-green"
        }`}
      >
        {isUser ? <IconUser size={16} /> : <IconBrain size={16} />}
      </div>

      <div
        className={`flex flex-col max-w-[80%] ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-paracosm-cyan/10 border border-paracosm-cyan/20"
              : "bg-paracosm-gray border border-paracosm-gray-light/20"
          }`}
        >
          <MessageMarkdown content={message.content} />
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-paracosm-green ml-1 animate-pulse" />
          )}
        </div>

        <div
          className={`flex items-center gap-2 mt-1 ${
            isUser ? "flex-row-reverse" : ""
          }`}
        >
          <span className="text-xs text-gray-500">
            {formatTime(message.timestamp)}
          </span>
          <MessageActions messageId={message.id} isUser={isUser} />
        </div>
      </div>
    </div>
  );
}
