"use client";

import { IconBase } from "./icon-base";

interface IconClockProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconClock({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconClockProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </IconBase>
  );
}
