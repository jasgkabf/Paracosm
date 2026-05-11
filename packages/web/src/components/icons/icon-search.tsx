"use client";

import { IconBase } from "./icon-base";

interface IconSearchProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconSearch({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconSearchProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </IconBase>
  );
}
