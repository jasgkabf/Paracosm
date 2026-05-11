"use client";

import { IconBase } from "./icon-base";

interface IconParacosmProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconParacosm({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconParacosmProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <circle cx="12" cy="12" r="10" /><path d="M12 2a7 7 0 0 0 0 14 7 7 0 0 1 0 10" /><circle cx="12" cy="9" r="2" />
    </IconBase>
  );
}
