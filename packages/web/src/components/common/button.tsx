"use client";

import { forwardRef } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const variantStyles: Record<string, string> = {
  primary: "bg-paracosm-green/20 text-paracosm-green hover:bg-paracosm-green/30 border border-paracosm-green/30",
  secondary: "bg-paracosm-gray text-white hover:bg-paracosm-gray-light/50 border border-paracosm-gray-light/30",
  ghost: "text-gray-400 hover:text-white hover:bg-paracosm-gray-light/20",
  danger: "bg-paracosm-red/20 text-paracosm-red hover:bg-paracosm-red/30 border border-paracosm-red/30",
};

const sizeStyles: Record<string, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-paracosm-green/30 disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
