"use client";

import { IconBase } from "./icon-base";

interface IconChevronRightProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconChevronRight({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconChevronRightProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <polyline points="9 18 15 12 9 6" />
    </IconBase>
  );
}
