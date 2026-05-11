"use client";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "error" | "warning" | "info";
  size?: "sm" | "md";
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: "bg-paracosm-gray-light/30 text-gray-300",
  success: "bg-paracosm-green/15 text-paracosm-green",
  error: "bg-paracosm-red/15 text-paracosm-red",
  warning: "bg-paracosm-yellow/15 text-paracosm-yellow",
  info: "bg-paracosm-cyan/15 text-paracosm-cyan",
};

const sizeStyles: Record<string, string> = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-0.5 text-xs",
};

export function Badge({ children, variant = "default", size = "md", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-md ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
}
