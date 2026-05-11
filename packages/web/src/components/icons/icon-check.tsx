"use client";

import { IconBase } from "./icon-base";

interface IconCheckProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconCheck({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconCheckProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <polyline points="20 6 9 17 4 12" />
    </IconBase>
  );
}
