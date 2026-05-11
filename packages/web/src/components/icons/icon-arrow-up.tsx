"use client";

import { IconBase } from "./icon-base";

interface IconArrowUpProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconArrowUp({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconArrowUpProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
    </IconBase>
  );
}
