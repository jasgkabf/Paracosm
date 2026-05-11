"use client";

import { IconBase } from "./icon-base";

interface IconPlusProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconPlus({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconPlusProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </IconBase>
  );
}
