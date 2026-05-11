"use client";

import { useState, useEffect, useCallback } from "react";
import { IconX, IconCheck, IconInfo, IconWarning } from "@/components/icons";

interface Toast {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const typeStyles: Record<string, { bg: string; border: string; icon: React.ReactNode }> = {
  success: {
    bg: "bg-paracosm-green/10",
    border: "border-paracosm-green/30",
    icon: <IconCheck size={16} className="text-paracosm-green" />,
  },
  error: {
    bg: "bg-paracosm-red/10",
    border: "border-paracosm-red/30",
    icon: <IconX size={16} className="text-paracosm-red" />,
  },
  info: {
    bg: "bg-paracosm-cyan/10",
    border: "border-paracosm-cyan/30",
    icon: <IconInfo size={16} className="text-paracosm-cyan" />,
  },
  warning: {
    bg: "bg-paracosm-yellow/10",
    border: "border-paracosm-yellow/30",
    icon: <IconWarning size={16} className="text-paracosm-yellow" />,
  },
};

function ToastItem({ toast, onDismiss }: ToastProps) {
  const style = typeStyles[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${style.bg} ${style.border} animate-slide-in-up`}
    >
      {style.icon}
      <span className="text-sm text-white flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-0.5 rounded text-gray-400 hover:text-white transition-colors"
      >
        <IconX size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}

export { ToastContainer, type Toast };
