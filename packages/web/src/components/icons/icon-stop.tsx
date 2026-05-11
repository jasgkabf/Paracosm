"use client";

import { IconBase } from "./icon-base";

interface IconStopProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconStop({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconStopProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    </IconBase>
  );
}
