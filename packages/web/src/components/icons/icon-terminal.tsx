"use client";

import { IconBase } from "./icon-base";

interface IconTerminalProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconTerminal({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconTerminalProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </IconBase>
  );
}
