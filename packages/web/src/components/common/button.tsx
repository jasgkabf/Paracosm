import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles: Record<string, string> = {
  primary: 'bg-paracosm-green text-paracosm-dark hover:bg-paracosm-green/90 shadow-glow-green-sm',
  secondary: 'bg-paracosm-gray text-paracosm-text border border-paracosm-border hover:border-paracosm-green/30',
  ghost: 'text-paracosm-muted hover:text-paracosm-text hover:bg-paracosm-gray/50',
  danger: 'bg-red-900/30 text-red-400 border border-red-800/50 hover:bg-red-900/50',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
