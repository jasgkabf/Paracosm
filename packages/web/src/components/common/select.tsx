"use client";

import { forwardRef } from "react";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = "", id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm text-gray-400 mb-1">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`w-full bg-paracosm-gray border rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 transition-colors appearance-none cursor-pointer ${
            error
              ? "border-paracosm-red/50 focus:border-paracosm-red focus:ring-paracosm-red/30"
              : "border-paracosm-gray-light/30 focus:border-paracosm-green/50 focus:ring-paracosm-green/30"
          } ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-paracosm-red mt-1">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
