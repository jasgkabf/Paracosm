"use client";

import { IconBase } from "./icon-base";

interface IconPauseProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconPause({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconPauseProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
    </IconBase>
  );
}
