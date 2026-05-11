"use client";

import { IconBase } from "./icon-base";

interface IconChartLineProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconChartLine({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconChartLineProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </IconBase>
  );
}
