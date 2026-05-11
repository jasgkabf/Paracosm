"use client";

import { IconBase } from "./icon-base";

interface IconLockProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconLock({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconLockProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </IconBase>
  );
}
