"use client";

import { IconX } from "@/components/icons";
import { Button } from "@/components/common/button";

interface StreamIndicatorProps {
  onStop: () => void;
}

export function StreamIndicator({ onStop }: StreamIndicatorProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-paracosm-green/5 border-t border-paracosm-green/10">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-paracosm-green animate-pulse" />
          <div className="w-1.5 h-1.5 rounded-full bg-paracosm-green animate-pulse [animation-delay:0.2s]" />
          <div className="w-1.5 h-1.5 rounded-full bg-paracosm-green animate-pulse [animation-delay:0.4s]" />
        </div>
        <span className="text-sm text-paracosm-green">Agent is responding...</span>
      </div>
      <Button variant="ghost" size="sm" onClick={onStop} className="text-gray-400 hover:text-paracosm-red">
        <IconX size={14} />
        <span className="ml-1">Stop</span>
      </Button>
    </div>
  );
}
