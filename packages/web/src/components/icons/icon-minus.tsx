"use client";

import { IconBase } from "./icon-base";

interface IconMinusProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconMinus({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconMinusProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </IconBase>
  );
}
