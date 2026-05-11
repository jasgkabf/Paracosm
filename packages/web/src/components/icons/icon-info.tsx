"use client";

import { IconBase } from "./icon-base";

interface IconInfoProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconInfo({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconInfoProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </IconBase>
  );
}
