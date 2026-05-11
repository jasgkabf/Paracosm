"use client";

import { IconBase } from "./icon-base";

interface IconChevronUpProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconChevronUp({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconChevronUpProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <polyline points="18 15 12 9 6 15" />
    </IconBase>
  );
}
