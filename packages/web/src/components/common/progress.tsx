"use client";

interface ProgressProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  color?: string;
  showLabel?: boolean;
  className?: string;
}

const sizeStyles: Record<string, string> = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

export function Progress({ value, max = 100, size = "md", color, showLabel, className = "" }: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const getColor = () => {
    if (color) return color;
    if (percentage < 50) return "bg-paracosm-green";
    if (percentage < 75) return "bg-paracosm-yellow";
    return "bg-paracosm-red";
  };

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={`progress-bar-track ${sizeStyles[size]}`}>
        <div
          className={`progress-bar-fill ${getColor()} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
