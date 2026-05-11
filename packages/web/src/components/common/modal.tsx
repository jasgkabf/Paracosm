'use client';

import React, { useEffect } from 'react';
import { IconX } from '@/components/icons';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative glass-panel p-6 w-full max-w-md mx-4 animate-fade-in">
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-paracosm-text">{title}</h3>
            <button
              onClick={onClose}
              className="text-paracosm-muted hover:text-paracosm-text transition-colors"
            >
              <IconX size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
