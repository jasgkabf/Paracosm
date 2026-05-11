"use client";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Slider({ value, onChange, min = 0, max = 100, step = 1, label, showValue, disabled, className = "" }: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-sm text-gray-400">{label}</span>}
          {showValue && <span className="text-sm font-mono text-white">{value}</span>}
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full accent-paracosm-green disabled:opacity-50"
        style={{
          background: `linear-gradient(to right, rgba(0, 255, 136, 0.4) 0%, rgba(0, 255, 136, 0.4) ${percentage}%, rgba(26, 26, 46, 0.5) ${percentage}%, rgba(26, 26, 46, 0.5) 100%)`,
        }}
      />
    </div>
  );
}
