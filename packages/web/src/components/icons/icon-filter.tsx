"use client";

import { IconBase } from "./icon-base";

interface IconFilterProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconFilter({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconFilterProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </IconBase>
  );
}
