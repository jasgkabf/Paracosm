"use client";

import { IconBase } from "./icon-base";

interface IconArrowLeftProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconArrowLeft({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconArrowLeftProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </IconBase>
  );
}
