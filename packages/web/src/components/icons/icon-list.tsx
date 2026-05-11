"use client";

import { IconBase } from "./icon-base";

interface IconListProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconList({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconListProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </IconBase>
  );
}
