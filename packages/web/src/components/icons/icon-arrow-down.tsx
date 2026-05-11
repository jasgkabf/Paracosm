"use client";

import { IconBase } from "./icon-base";

interface IconArrowDownProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconArrowDown({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconArrowDownProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
    </IconBase>
  );
}
