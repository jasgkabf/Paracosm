"use client";

import { IconBase } from "./icon-base";

interface IconChartPieProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconChartPie({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconChartPieProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" />
    </IconBase>
  );
}
