'use client';

import { useState, useRef, useCallback } from 'react';
import { IconSend } from '@/components/icons';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  return (
    <div className="flex items-end gap-3 pt-4 border-t border-paracosm-border mt-4">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        disabled={disabled}
        rows={1}
        className="flex-1 bg-paracosm-dark border border-paracosm-border rounded-lg px-4 py-3 text-sm text-paracosm-text placeholder:text-paracosm-muted/50 resize-none focus:outline-none focus:border-paracosm-green/50 transition-colors max-h-[200px]"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !input.trim()}
        className="shrink-0 w-10 h-10 rounded-lg bg-paracosm-green text-paracosm-dark flex items-center justify-center hover:bg-paracosm-green/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <IconSend size={18} color="#0a0a0f" />
      </button>
    </div>
  );
}
