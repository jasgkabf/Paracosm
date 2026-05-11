"use client";

import { IconBase } from "./icon-base";

interface IconSendProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconSend({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconSendProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </IconBase>
  );
}
