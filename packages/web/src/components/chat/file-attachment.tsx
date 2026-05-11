"use client";

import { IconX, IconFile, IconImage } from "@/components/icons";

interface FileAttachmentProps {
  file: File;
  onRemove: () => void;
}

export function FileAttachment({ file, onRemove }: FileAttachmentProps) {
  const isImage = file.type.startsWith("image/");

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="flex items-center gap-2 bg-paracosm-gray rounded-lg px-3 py-2 border border-paracosm-gray-light/20">
      {isImage ? (
        <IconImage size={16} className="text-paracosm-cyan flex-shrink-0" />
      ) : (
        <IconFile size={16} className="text-gray-400 flex-shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm text-white truncate">{file.name}</div>
        <div className="text-xs text-gray-500">{formatSize(file.size)}</div>
      </div>
      <button
        onClick={onRemove}
        className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-paracosm-red transition-colors"
      >
        <IconX size={14} />
      </button>
    </div>
  );
}
