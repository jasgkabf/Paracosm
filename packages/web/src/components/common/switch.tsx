"use client";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function Switch({ checked, onChange, disabled, label, className = "" }: SwitchProps) {
  return (
    <label className={`inline-flex items-center gap-2 cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? "bg-paracosm-green/40" : "bg-paracosm-gray-light/30"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
            checked ? "translate-x-4 bg-paracosm-green" : "translate-x-0.5 bg-gray-400"
          }`}
        />
      </button>
      {label && <span className="text-sm text-gray-400">{label}</span>}
    </label>
  );
}
