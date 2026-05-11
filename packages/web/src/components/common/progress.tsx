import React from 'react';

interface ProgressProps {
  value: number;
  max?: number;
  color?: 'green' | 'cyan' | 'yellow' | 'red';
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

const colorStyles: Record<string, string> = {
  green: 'bg-paracosm-green',
  cyan: 'bg-paracosm-cyan',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

const sizeStyles: Record<string, string> = {
  sm: 'h-1',
  md: 'h-2',
};

export function Progress({
  value,
  max = 100,
  color = 'green',
  size = 'md',
  showLabel = false,
  className = '',
}: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between text-xs text-paracosm-muted mb-1">
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className={`w-full bg-paracosm-gray rounded-full overflow-hidden ${sizeStyles[size]}`}>
        <div
          className={`${colorStyles[color]} ${sizeStyles[size]} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
