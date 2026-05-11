import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className = '', ...props }: SelectProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm text-paracosm-muted">{label}</label>
      )}
      <select
        className={`w-full bg-paracosm-dark border border-paracosm-border rounded-md px-3 py-2 text-sm text-paracosm-text focus:outline-none focus:border-paracosm-green/50 transition-colors ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
