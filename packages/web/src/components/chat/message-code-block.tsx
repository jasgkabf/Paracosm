"use client";

import { useState } from "react";
import { IconCopy, IconCheck } from "@/components/icons";
import { useClipboard } from "@/hooks/use-clipboard";

interface MessageCodeBlockProps {
  language: string;
  code: string;
}

export function MessageCodeBlock({ language, code }: MessageCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const { copyToClipboard } = useClipboard();

  const handleCopy = async () => {
    await copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-paracosm-gray-light/20">
      <div className="flex items-center justify-between px-4 py-2 bg-paracosm-gray-dark border-b border-paracosm-gray-light/20">
        <span className="text-xs text-gray-400 font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <IconCheck size={14} className="text-paracosm-green" />
              <span className="text-paracosm-green">Copied</span>
            </>
          ) : (
            <>
              <IconCopy size={14} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto">
        <pre className="p-4 text-sm font-mono text-gray-300 bg-paracosm-dark/50 leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
