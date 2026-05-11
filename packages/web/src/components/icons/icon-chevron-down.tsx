"use client";

import { IconBase } from "./icon-base";

interface IconChevronDownProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconChevronDown({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconChevronDownProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <polyline points="6 9 12 15 18 9" />
    </IconBase>
  );
}
