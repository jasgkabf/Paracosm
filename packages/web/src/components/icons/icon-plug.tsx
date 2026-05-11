"use client";

import { IconBase } from "./icon-base";

interface IconPlugProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconPlug({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconPlugProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <path d="M12 22v-5" /><path d="M9 8V2" /><path d="M15 8V2" /><path d="M18 8v5a6 6 0 0 1-12 0V8z" />
    </IconBase>
  );
}
