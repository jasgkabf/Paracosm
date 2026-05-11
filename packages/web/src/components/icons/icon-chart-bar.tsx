"use client";

import { IconBase } from "./icon-base";

interface IconChartBarProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconChartBar({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconChartBarProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
    </IconBase>
  );
}
