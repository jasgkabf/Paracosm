"use client";

import { IconBase } from "./icon-base";

interface IconCustomLlmProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
}

export function IconCustomLlm({ size = 24, color = "currentColor", strokeWidth = 2, className = "", spin, pulse }: IconCustomLlmProps) {
  return (
    <IconBase size={size} color={color} strokeWidth={strokeWidth} className={className} spin={spin} pulse={pulse}>
      <rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="7" cy="12" r="2" /><line x1="12" y1="9" x2="18" y2="9" /><line x1="12" y1="12" x2="18" y2="12" /><line x1="12" y1="15" x2="16" y2="15" />
    </IconBase>
  );
}
