import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: 'green' | 'cyan' | 'none';
}

const glowStyles: Record<string, string> = {
  green: 'border-paracosm-green/20 shadow-glow-green-sm',
  cyan: 'border-paracosm-cyan/20 shadow-glow-cyan-sm',
  none: '',
};

export function Card({ children, className = '', glow = 'none' }: CardProps) {
  return (
    <div
      className={`glass-panel p-4 ${glowStyles[glow]} ${className}`}
    >
      {children}
    </div>
  );
}
