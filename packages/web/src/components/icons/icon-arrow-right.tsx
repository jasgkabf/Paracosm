"use client";

import { IconBase } from "./icon-base";

interface IconArrowRightProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconArrowRight({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconArrowRightProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </IconBase>
  );
}
