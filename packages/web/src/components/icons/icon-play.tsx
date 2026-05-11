"use client";

import { IconBase } from "./icon-base";

interface IconPlayProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconPlay({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconPlayProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </IconBase>
  );
}
