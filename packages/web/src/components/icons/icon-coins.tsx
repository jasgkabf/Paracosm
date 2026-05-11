"use client";

import { IconBase } from "./icon-base";

interface IconCoinsProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconCoins({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconCoinsProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <circle cx="12" cy="12" r="10" /><path d="M12 6v12" /><path d="M8 8h6a2 2 0 0 1 0 4H8z" /><path d="M8 12h7a2 2 0 0 1 0 4H8z" />
    </IconBase>
  );
}
