"use client";

interface IconBaseProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  pulse?: boolean;
  children: React.ReactNode;
}

export function IconBase({
  size = 24,
  color = "currentColor",
  strokeWidth = 2,
  className = "",
  spin,
  pulse,
  children,
}: IconBaseProps) {
  const animationClass = spin ? "animate-spin" : pulse ? "animate-pulse" : "";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block flex-shrink-0 ${animationClass} ${className}`}
    >
      {children}
    </svg>
  );
}
