"use client";

import { IconCopy, IconRefresh, IconTrash, IconEdit } from "@/components/icons";
import { useClipboard } from "@/hooks/use-clipboard";

interface MessageActionsProps {
  messageId: string;
  isUser: boolean;
}

export function MessageActions({ messageId, isUser }: MessageActionsProps) {
  const { copyToClipboard } = useClipboard();

  const handleCopy = () => {
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl) {
      copyToClipboard(messageEl.textContent || "");
    }
  };

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={handleCopy}
        className="p-1 rounded text-gray-500 hover:text-white hover:bg-paracosm-gray-light/30 transition-colors"
        title="Copy message"
      >
        <IconCopy size={14} />
      </button>

      {isUser && (
        <button
          className="p-1 rounded text-gray-500 hover:text-white hover:bg-paracosm-gray-light/30 transition-colors"
          title="Edit message"
        >
          <IconEdit size={14} />
        </button>
      )}

      {!isUser && (
        <button
          className="p-1 rounded text-gray-500 hover:text-white hover:bg-paracosm-gray-light/30 transition-colors"
          title="Regenerate response"
        >
          <IconRefresh size={14} />
        </button>
      )}

      <button
        className="p-1 rounded text-gray-500 hover:text-paracosm-red hover:bg-paracosm-red/10 transition-colors"
        title="Delete message"
      >
        <IconTrash size={14} />
      </button>
    </div>
  );
}
