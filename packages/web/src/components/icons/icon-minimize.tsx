"use client";

import { IconBase } from "./icon-base";

interface IconMinimizeProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconMinimize({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconMinimizeProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
    </IconBase>
  );
}
