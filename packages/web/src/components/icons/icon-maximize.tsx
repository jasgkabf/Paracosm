"use client";

import { IconBase } from "./icon-base";

interface IconMaximizeProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconMaximize({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconMaximizeProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
    </IconBase>
  );
}
