"use client";

import { useEffect, useCallback, useRef } from "react";

type KeyCombo = string;

interface KeyboardHandler {
  key: KeyCombo;
  handler: () => void;
  description?: string;
}

interface UseKeyboardOptions {
  handlers: KeyboardHandler[];
  enabled?: boolean;
}

export function useKeyboard({ handlers, enabled = true }: UseKeyboardOptions) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const parts: string[] = [];
      if (event.ctrlKey || event.metaKey) parts.push("mod");
      if (event.shiftKey) parts.push("shift");
      if (event.altKey) parts.push("alt");
      parts.push(event.key.toLowerCase());
      const combo = parts.join("+");

      const handler = handlersRef.current.find((h) => h.key === combo);
      if (handler) {
        event.preventDefault();
        handler.handler();
      }
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown, enabled]);
}
