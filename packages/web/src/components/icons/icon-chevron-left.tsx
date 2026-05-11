"use client";

import { IconBase } from "./icon-base";

interface IconChevronLeftProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconChevronLeft({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconChevronLeftProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <polyline points="15 18 9 12 15 6" />
    </IconBase>
  );
}
