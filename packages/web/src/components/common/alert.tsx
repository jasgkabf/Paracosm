"use client";

interface AlertProps {
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<string, { bg: string; border: string; text: string }> = {
  info: { bg: "bg-paracosm-cyan/5", border: "border-paracosm-cyan/20", text: "text-paracosm-cyan" },
  success: { bg: "bg-paracosm-green/5", border: "border-paracosm-green/20", text: "text-paracosm-green" },
  warning: { bg: "bg-paracosm-yellow/5", border: "border-paracosm-yellow/20", text: "text-paracosm-yellow" },
  error: { bg: "bg-paracosm-red/5", border: "border-paracosm-red/20", text: "text-paracosm-red" },
};

export function Alert({ variant = "info", title, children, className = "" }: AlertProps) {
  const styles = variantStyles[variant];

  return (
    <div className={`rounded-lg border p-4 ${styles.bg} ${styles.border} ${className}`}>
      {title && (
        <h4 className={`text-sm font-medium ${styles.text} mb-1`}>{title}</h4>
      )}
      <div className="text-sm text-gray-300">{children}</div>
    </div>
  );
}
