import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm text-paracosm-muted">{label}</label>
      )}
      <input
        className={`w-full bg-paracosm-dark border border-paracosm-border rounded-md px-3 py-2 text-sm text-paracosm-text placeholder:text-paracosm-muted/50 focus:outline-none focus:border-paracosm-green/50 transition-colors ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
