"use client";

import { IconBase } from "./icon-base";

interface IconLayersProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconLayers({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconLayersProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </IconBase>
  );
}
