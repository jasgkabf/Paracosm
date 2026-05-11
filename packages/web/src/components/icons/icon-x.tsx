"use client";

import { IconBase } from "./icon-base";

interface IconXProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconX({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconXProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </IconBase>
  );
}
