import React from 'react';
import { IconX } from '@/components/icons';

interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

const variantStyles: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  info: {
    bg: 'bg-paracosm-cyan/5',
    border: 'border-paracosm-cyan/20',
    text: 'text-paracosm-cyan',
    icon: '#00d4ff',
  },
  success: {
    bg: 'bg-paracosm-green/5',
    border: 'border-paracosm-green/20',
    text: 'text-paracosm-green',
    icon: '#00ff88',
  },
  warning: {
    bg: 'bg-yellow-900/10',
    border: 'border-yellow-800/30',
    text: 'text-yellow-400',
    icon: '#facc15',
  },
  error: {
    bg: 'bg-red-900/10',
    border: 'border-red-800/30',
    text: 'text-red-400',
    icon: '#ef4444',
  },
};

export function Alert({ variant = 'info', title, children, onClose, className = '' }: AlertProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={`rounded-md border p-4 ${styles.bg} ${styles.border} ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          {title && (
            <h4 className={`text-sm font-medium ${styles.text} mb-1`}>{title}</h4>
          )}
          <div className="text-sm text-paracosm-muted">{children}</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-paracosm-muted hover:text-paracosm-text transition-colors"
          >
            <IconX size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
