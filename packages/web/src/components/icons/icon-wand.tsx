"use client";

import { IconBase } from "./icon-base";

interface IconWandProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconWand({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconWandProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" /><path d="M17.8 11.8L19 13" /><path d="M15 9h0" /><path d="M17.8 6.2L19 5" /><path d="M11 6.2L9.7 5" /><path d="M11 11.8L9.7 13" /><path d="M3 21l9-9" />
    </IconBase>
  );
}
