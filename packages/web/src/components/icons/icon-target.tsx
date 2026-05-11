"use client";

import { IconBase } from "./icon-base";

interface IconTargetProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconTarget({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconTargetProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </IconBase>
  );
}
