"use client";

import { IconBase } from "./icon-base";

interface IconBookmarkProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconBookmark({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconBookmarkProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </IconBase>
  );
}
