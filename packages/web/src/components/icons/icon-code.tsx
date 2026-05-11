"use client";

import { IconBase } from "./icon-base";

interface IconCodeProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconCode({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconCodeProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </IconBase>
  );
}
