"use client";

import { FileAttachment } from "./file-attachment";
import { IconSend, IconPlus, IconMic } from "@/components/icons";
import { useState, useRef, useCallback } from "react";

interface MessageInputProps {
  onSend: (content: string, attachments?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({ onSend, disabled, placeholder }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    if (!content.trim() && attachments.length === 0) return;
    onSend(content.trim(), attachments.length > 0 ? attachments : undefined);
    setContent("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [content, attachments, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  return (
    <div className="border-t border-paracosm-gray-light/20 bg-paracosm-gray-dark/50 p-4">
      <div className="max-w-3xl mx-auto">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachments.map((file, index) => (
              <FileAttachment
                key={`${file.name}-${index}`}
                file={file}
                onRemove={() => removeAttachment(index)}
              />
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-paracosm-gray-light/30 transition-colors"
            title="Attach file"
          >
            <IconPlus size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || "Send a message..."}
              disabled={disabled}
              rows={1}
              className="w-full bg-paracosm-gray border border-paracosm-gray-light/30 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-paracosm-green/50 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <button
            onClick={() => setIsRecording(!isRecording)}
            className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              isRecording
                ? "bg-paracosm-red/20 text-paracosm-red"
                : "text-gray-400 hover:text-white hover:bg-paracosm-gray-light/30"
            }`}
            title="Voice input"
          >
            <IconMic size={18} />
          </button>

          <button
            onClick={handleSubmit}
            disabled={disabled || (!content.trim() && attachments.length === 0)}
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-paracosm-green/20 text-paracosm-green hover:bg-paracosm-green/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Send message"
          >
            <IconSend size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
