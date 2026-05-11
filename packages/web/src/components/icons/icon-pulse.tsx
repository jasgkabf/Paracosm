"use client";

import { IconBase } from "./icon-base";

interface IconPulseProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconPulse({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconPulseProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <polyline points="2 12 6 12 8 4 12 20 16 8 18 12 22 12" />
    </IconBase>
  );
}
