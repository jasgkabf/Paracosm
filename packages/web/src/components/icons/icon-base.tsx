import React from 'react';

export interface IconBaseProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  spin?: boolean;
  pulse?: boolean;
  className?: string;
}

export function IconBase({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
  spin = false,
  pulse = false,
  className = '',
  children,
}: IconBaseProps & { children: React.ReactNode }) {
  const animationClass = spin ? 'animate-spin' : pulse ? 'animate-pulse-glow' : '';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${animationClass} ${className}`.trim()}
    >
      {children}
    </svg>
  );
}
