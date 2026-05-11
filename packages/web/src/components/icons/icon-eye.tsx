"use client";

import { IconBase } from "./icon-base";

interface IconEyeProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconEye({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconEyeProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </IconBase>
  );
}
