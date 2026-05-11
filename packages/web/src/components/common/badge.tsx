import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: 'bg-paracosm-gray text-paracosm-muted',
  success: 'bg-paracosm-green/10 text-paracosm-green border border-paracosm-green/20',
  warning: 'bg-yellow-900/20 text-yellow-400 border border-yellow-800/30',
  danger: 'bg-red-900/20 text-red-400 border border-red-800/30',
  info: 'bg-paracosm-cyan/10 text-paracosm-cyan border border-paracosm-cyan/20',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
