"use client";

import { IconBase } from "./icon-base";

interface IconUserProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconUser({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconUserProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </IconBase>
  );
}
