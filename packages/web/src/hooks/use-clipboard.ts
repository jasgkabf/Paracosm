"use client";

import { useCallback } from "react";

interface UseClipboardReturn {
  copyToClipboard: (text: string) => Promise<boolean>;
  readFromClipboard: () => Promise<string>;
}

export function useClipboard(): UseClipboardReturn {
  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  }, []);

  const readFromClipboard = useCallback(async (): Promise<string> => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        return await navigator.clipboard.readText();
      }
      return "";
    } catch {
      return "";
    }
  }, []);

  return { copyToClipboard, readFromClipboard };
}
